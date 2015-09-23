var Window        = require('pex-sys/Window');
var Draw          = require('pex-draw');
var glslify       = require('./local_modules/glslify-sync');
var PerspCamera   = require('pex-cam/PerspCamera');
var Arcball       = require('pex-cam/Arcball');
var GUI           = require('pex-gui');

Window.create({
    settings: {
        width: 1280,
        height: 720
    },
    resourcesRaw: {
        showColorsVert  : { text : glslify(__dirname + '/assets/glsl/ShowColors.vert')},
        showColorsFrag  : { text : glslify(__dirname + '/assets/glsl/ShowColors.frag')},
        solidColorVert  : { text : glslify(__dirname + '/assets/glsl/SolidColor.vert')},
        solidColorFrag  : { text : glslify(__dirname + '/assets/glsl/SolidColor.frag')},
        showNormalsVert : { text : glslify(__dirname + '/assets/glsl/ShowNormals.vert')},
        snoNormalsFrag  : { text : glslify(__dirname + '/assets/glsl/ShowNormals.frag')}
    },
    init: function() {
        var ctx = this.getContext();
        this.debugDraw = new Draw(ctx);

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.gui.addHeader('Settings');

        this.camera  = new PerspCamera(45, this.getAspectRatio(), 0.01, 20.0);
        this.camera.lookAt([0, 2, 2], [0, 0, 0], [0, 1, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());
        ctx.setViewMatrix(this.camera.getViewMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setRadiusScale(1.5);
        this.arcball.setSpeed(1);
        this.addEventListener(this.arcball);

        this.showColorsProgram = ctx.createProgram(this.resourcesRaw.showColorsVert.text, this.resourcesRaw.showColorsFrag.text);
        this.solidColorProgram = ctx.createProgram(this.resourcesRaw.solidColorVert.text, this.resourcesRaw.solidColorFrag.text);
    },
    draw: function() {
        var ctx = this.getContext();

        ctx.setClearColor(0.1, 0.1, 0.1, 1.0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setDepthTest(true);

        this.arcball.apply();
        ctx.setViewMatrix(this.camera.getViewMatrix());
        ctx.setLineWidth(2);

        ctx.bindProgram(this.showColorsProgram);
        this.debugDraw.drawPivotAxes(0.5);
        this.debugDraw.setColor([0.5, 0.5, 0.5, 1.0]);
        this.debugDraw.drawGrid([5, 5], 10);

        this.gui.draw();
    }
})
