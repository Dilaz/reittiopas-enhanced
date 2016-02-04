var gulp = require('gulp');
var jshint = require('gulp-jshint');
var browserify = require('gulp-browserify');

var argv = require('yargs').argv;

gulp.task('lint', function() {
	gulp.src('src/reittiopas.js')
	.pipe(jshint())
	.pipe(jshint.reporter('jshint-stylish'))
	.on('error', function() {
		// beep();
	});
});

gulp.task('js', function() {
	gulp.src('src/reittiopas.js')
	.pipe(browserify({
		insertGlobals: true,
		debug: !argv.production
	}))
	.pipe(gulp.dest('dist/'));
});

gulp.task('watch', ['lint', 'js'],function() {
	gulp.watch('src/**/*.js', ['lint', 'js']);
});

gulp.task('default', ['lint', 'js']);
