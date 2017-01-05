var fs = require('fs-extra');
var glob = require('glob');
var path = require('path');
var mkdirp = require('mkdirp');
var calipers = require('calipers')('png','jpeg','gif');
var copyfiles = require('quickly-copy-file');

var commandLineArguments = require('command-line-args');

var options = commandLineArguments([
  {name: 'verbose', alias: 'v', type: Boolean},
  {name: 'batchsize', alias: 'b', type: Number},
  {name: 'samplesize', alias: 's', type: Number},
  {name: 'files', type: String, multiple: true, defaultOption: true}
]).parse();

var mediaDir = options.files[0],
    copyMediaDir = options.files[1];

if (!mediaDir || !copyMediaDir) {
  throw new Error("Must provide arguments for existing media directory and target location.");
}

var sampleSize = options.samplesize || 10,
    batchSize = options.batchsize || 100,
    verbose = options.verbose;

var images = {};
var imgExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif'
];
var blacklistExtensions = [
  '.mp3',
  '.pdf',
  '.js',
  '.css',
  '.txt',
  '.info',
  '.csv',
  '.swp',
  '.xml',
  '.html',
  '.c'
];

var calculateAspectRation = function(width, height) {
  return width/height;
};

var getRandomCopiedImage = function(images, width, height) {
  var index = Math.floor(images[width][height].length * Math.random());
  return images[width][height][index];
};



if (!fs.existsSync(copyMediaDir)){
  mkdirp.sync(copyMediaDir, function(err){
    if (err) { console.error(err) }
    else if (verbose) { console.log('Created new directory: ' + copyMediaDir)}
  });
}

glob(mediaDir + '/**/*', {nodir: true}, function(err, files) {
  files.forEach(function(file) {
    var copyFile = copyMediaDir + file.replace(mediaDir, '');
    // Skip blacklisted items
    if (blacklistExtensions.some(function(ext){return ext == path.extname(file);})) {
      if (verbose) console.log("Skipping file because its extension is blacklisted: " + file);
      return;
    }
    // If the file is not an image file, just copy it
    if (!imgExtensions.some(function(ext){return ext == path.extname(file);})) {
      //fs does not have a copy method, need fs-extra
      copyfiles(file, copyFile, function(err,file){
        if(err) { console.error(err) }
        else if (verbose) { console.log("Copying non-image file: " + file + " to " + copyFile)}
      });
      return;
    }

    /**
     * TODO Some images cannot be read,
     * 'fd must be a file descriptor' - maybe some issue between .jpeg/.jpg?
     * Also limited to png,jpg,gif types
     */
    calipers.measure(file,function(err,result) {
      if(err){console.error(err)}
      //If result is undefined for a particular file, return so we can continue to sanitize
      if(result == undefined) {
        return console.log('Result was undefined, could not read file: ' + file);
      }

      //Get width and height from result object
      var width = result.pages.width,
          height = result.pages.height;

      //Calculate the aspect ratio based on width/height of a particular image
      var aspectRation = calculateAspectRation(width, height);

      //width and height 'keys'
      width = width / aspectRation;
      height = height / aspectRation;

      if (!images.hasOwnProperty(width)) {
        images[width] = {};
      }
      if (!images[width].hasOwnProperty(height)) {
        images[width][height] = [];
      }

      //Keeps the amount of images copied vs those linked according to sample size
      if (images[width][height].length < sampleSize) {
        //images keeps track of those that are copied
        images[width][height].push(copyFile);

        //Sync copy, because async copying results in attempts to link files that are not done copying
        fs.copySync(file,copyFile);
      }
      else {

        //Gets a random image that was copied to be used for linking
        var randomImage = getRandomCopiedImage(images,width,height);

        //async creates a hard link
        fs.ensureLink(randomImage, copyFile, function (err) {
          if (err) {
            console.log("Could not link " + randomImage + " to " + copyFile);
            console.error(err)
          }
          else if (verbose) {
            console.log("Linking image file: " + randomImage + " to " + copyFile)
          }
        });
      }
    });

  });
});