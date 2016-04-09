var Window        = require('pex-sys/Window');
var MouseEvent    = require('pex-sys/MouseEvent');
var Mat4          = require('pex-math/Mat4');
var Vec3          = require('pex-math/Vec3');
var createSphere  = require('primitive-sphere');
var Draw          = require('pex-draw/Draw');
var PerspCamera   = require('pex-cam/PerspCamera');
var Arcball       = require('pex-cam/Arcball');
var Renderer      = require('../../../pex-renderer').Renderer;
var createSphere  = require('primitive-sphere');
var createCube    = require('primitive-cube');
var Draw          = require('pex-draw');
var isBrowser     = require('is-browser');
var loadScene     = require('./load-scene');
var async         = require('async');
var ASSETS_DIR    = isBrowser ? '' : __dirname + '/';

var MODELS_DIR    = isBrowser ? '../glTF/sampleModels' : __dirname + '/../glTF/sampleModels';

var MODELS = [
    MODELS_DIR + '/2_cylinder_engine/glTF/2_cylinder_engine.gltf',
    MODELS_DIR + '/brainsteam/glTF/brainsteam.gltf',
    MODELS_DIR + '/buggy/glTF/buggy.gltf',
    MODELS_DIR + '/CesiumMan/glTF/Cesium_Man.gltf',
    MODELS_DIR + '/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf',
    MODELS_DIR + '/duck/glTF/duck.gltf',
    MODELS_DIR + '/gearbox_assy/glTF/gearbox_assy.gltf',
    MODELS_DIR + '/monster/glTF/monster.gltf',
    MODELS_DIR + '/Reciprocating_Saw/glTF/Reciprocating_Saw.gltf',
    MODELS_DIR + '/RiggedFigure/glTF/rigged-figure.gltf',
    MODELS_DIR + '/RiggedSimple/glTF/RiggedSimple.gltf',
]

Window.create({
    settings: {
        type: '3d',
        width: 1280,
        height: 720,
        fullScreen: isBrowser,
        pixelRatio: 1
    },
    sunPosition: [0, 5, -5],
    elevation: 35,
    azimuth: 0,
    elevationMat: Mat4.create(),
    rotationMat: Mat4.create(),
    init: function() {
        var res = this.getResources();
        var ctx = this.getContext();
        var self = this;

        if (isBrowser) {
            var ext = ctx.getGL().getExtension('WEBGL_draw_buffers')
            console.log(ext)
        }

        var renderer = this.renderer = new Renderer(ctx, this.getWidth(), this.getHeight());
        renderer._state.exposure = 2.0;

        this.camera = new PerspCamera(45, this.getAspectRatio(), 0.001, 100.0);;
        this.camera.lookAt([3.5,2,3], [0,0,0]);
        renderer.createCameraNode(this.camera);

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.addEventListener(this.arcball);

        var sunDir = Vec3.normalize([1, 0.1, 0]);
        this.sunLightNode = renderer.createDirectionalLightNode(sunDir);

        var floorMesh = this.buildMesh(createCube(14, 0.02, 44));
        var floorNode = renderer.createMeshNode(floorMesh);
        Vec3.set3(floorNode._position, 0, -0, 0);

        this.updateSunPosition();

        async.map(MODELS, function(file, cb) {
            loadScene(ctx, renderer, file, cb)
        }, function(err, scenes) {
            scenes.forEach(function(scene, i) {
                var x = i % 4;
                var z = (i / 4) | 0;
                scene._position[0] -= (-1.5 + x) * 1.2;
                scene._position[2] -= (-1.5 + z) * 1.2;
            })

            this.renderer._state.dirtySky = true;
            console.log(scenes.length)
        }.bind(this));
    },
    updateSunPosition: function() {
        Mat4.setRotation(this.elevationMat, this.elevation/180*Math.PI, [0, 0, 1]);
        Mat4.setRotation(this.rotationMat, this.azimuth/180*Math.PI, [0, 1, 0]);

        //TODO: set sun direction

        Vec3.set3(this.renderer._state.sunPosition, 1, 0, 0);
        Vec3.multMat4(this.renderer._state.sunPosition, this.elevationMat);
        Vec3.multMat4(this.renderer._state.sunPosition, this.rotationMat);
    },
    buildMesh: function(geometry, primitiveType) {
        var ctx = this.getContext();
        sphere = createSphere();
        var attributes = [
            { data: geometry.positions, location: ctx.ATTRIB_POSITION },
            { data: geometry.uvs, location: ctx.ATTRIB_TEX_COORD_0 },
            { data: geometry.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var indices = { data: geometry.cells };
        return ctx.createMesh(attributes, indices, primitiveType);
    },
    draw: function() {
        this.arcball.apply();
        this.renderer.draw();
    }
})
