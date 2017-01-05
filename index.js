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
     * 'fd must be a file descriptor'
     */
    calipers.measure(file,function(err,result) {
      if(err){

        console.log(file);
        console.error(err);
      }
      if(result == undefined) {
        return console.log('Result was undefined, could not read file: ' + file);
      }
      var width = result.pages.width,
          height = result.pages.height;

      var aspectRation = calculateAspectRation(width, height);

      width = width / aspectRation;
      height = height / aspectRation;

      if (!images.hasOwnProperty(width)) {
        images[width] = {};
      }
      if (!images[width].hasOwnProperty(height)) {
        images[width][height] = [];
      }
      if (images[width][height].length < sampleSize) {
        // Copy image
        images[width][height].push(copyFile);


        fs.copySync(file,copyFile);
        // copyfiles(file, copyFile, function (err, file) {
        //   if (err) {
        //     console.error(err)
        //   }
        //   else if (verbose) console.error("Copying image file: " + file + " to " + copyFile);
        //
        // });
      } else {
        // Create link to random previously copied image
        /* TODO There has got to be a better way to do this.
         * But still generating 'No such file or directory'
         * on some images when trying to create link
         * */

        var randomImage = getRandomCopiedImage(images,width,height);

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