var fs = require('fs');
var glob = require('glob');
var lwip = require('lwip');

var pathToMedia = process.argv[2];
var pathToCopyMedia = process.argv[3];

if (!pathToMedia || !pathToCopyMedia) {
  console.error("Must provide arguments for existing media directory and target location.");
}

var sampleSize = 10;
var images = {};
var extensions = [
  /.*\.png/i,
  /.*\.jpg/i,
  /.*\.jpeg/i,
  /.*\.gif/i
];

if (!fs.existsSync(pathToCopyMedia)){
  fs.mkdirSync(pathToCopyMedia); 
}

glob(pathToMedia + '/**/*', function(err, files) {
  files.forEach(function(file) {
    var pathToCopyFile = pathToCopyMedia + file.replace(pathToMedia, '');
    if (fs.lstatSync(file).isDirectory() && !fs.existsSync(pathToCopyFile)) {
      fs.mkdirSync(pathToCopyFile);
    } else {
      //todo create white list of image files
      if(extensions.every(function(regex){return !file.match(regex);})) {
        fs.createWriteStream(pathToCopyFile);
        return;
      }
      lwip.open(file, function(err, image) {
        if (err) {

          console.error(err)
          fs.createWriteStream(pathToCopyFile);
          return;
        }

        var width = image.width(),
          height = image.height();
        if (!images.hasOwnProperty(width)) {
          images[width] = {};
        }
        if (!images[width].hasOwnProperty(height)) {
          images[width][height] = [];
        }


        if (images[width][height].length < sampleSize) {
          images[width][height].push(file);
          // Create new image file in new folder
          fs.createWriteStream(pathToCopyFile);
        } else {
          // Create symlink in new folder
          var randomIndex = Math.floor(images[width][height].length * Math.random());
          var randomImage = images[width][height][randomIndex];
          fs.symlink(pathToCopyMedia + randomImage.replace(pathToMedia, ''), pathToCopyFile);
        }
      });
    }
  });
});