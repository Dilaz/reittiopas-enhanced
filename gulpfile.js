var gulp = require('gulp');
var gulpIf = require('gulp-if');
var jshint = require('gulp-jshint');
var uglify = require('gulp-uglify');
var browserify = require('gulp-browserify');
var babel = require('gulp-babel');

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
	.pipe(babel({
		presets: ['es2015'],
	}))
	.pipe(browserify({
		insertGlobals: true,
		debug: !argv.production
	}))
	.pipe(gulpIf(argv.production, uglify()))
	.pipe(gulp.dest('dist/'));
});

gulp.task('watch', ['lint', 'js'],function() {
	gulp.watch('src/**/*.js', ['lint', 'js']);
});

gulp.task('default', ['lint', 'js']);
