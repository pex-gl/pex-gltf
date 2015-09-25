var Window        = require('pex-sys/Window');
var Draw          = require('pex-draw');
var glslify       = require('./local_modules/glslify-sync');
var PerspCamera   = require('pex-cam/PerspCamera');
var Arcball       = require('pex-cam/Arcball');
var GUI           = require('pex-gui');
var debug         = require('debug').enable('*');
var log           = require('debug')('main');
var loadGLTF      = require('../');
var isBrowser     = require('is-browser');
var Vec3          = require('pex-math/Vec3');
var iterateObject = require('iterate-object');
var Mat4          = require('pex-math/Mat4');
var mult44        = require('gl-mat4/multiply')
var random        = require('pex-random');


var ASSETS_DIR    = isBrowser ? 'assets' : __dirname + '/assets';

Window.create({
    settings: {
        width: 1280,
        height: 720
    },
    resourcesRaw: {
        showColorsVert    : { text : glslify(__dirname + '/assets/glsl/ShowColors.vert')},
        showColorsFrag    : { text : glslify(__dirname + '/assets/glsl/ShowColors.frag')},
        solidColorVert    : { text : glslify(__dirname + '/assets/glsl/SolidColor.vert')},
        solidColorFrag    : { text : glslify(__dirname + '/assets/glsl/SolidColor.frag')},
        showNormalsVert   : { text : glslify(__dirname + '/assets/glsl/ShowNormals.vert')},
        showNormalsFrag   : { text : glslify(__dirname + '/assets/glsl/ShowNormals.frag')},
        showTexCoordsVert : { text : glslify(__dirname + '/assets/glsl/ShowTexCoords.vert')},
        showTexCoordsFrag : { text : glslify(__dirname + '/assets/glsl/ShowTexCoords.frag')}
    },
    init: function() {
        var ctx = this.getContext();
        this.debugDraw = new Draw(ctx);

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.gui.addHeader('Settings');

        this.camera  = new PerspCamera(45, this.getAspectRatio(), 0.01, 200.0);
        this.camera.lookAt([-2, 0.5, -2], [0, 0, 0], [0, 1, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());
        ctx.setViewMatrix(this.camera.getViewMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setRadiusScale(1.5);
        this.arcball.setSpeed(1);
        this.addEventListener(this.arcball);

        this.showColorsProgram = ctx.createProgram(this.resourcesRaw.showColorsVert.text, this.resourcesRaw.showColorsFrag.text);
        this.solidColorProgram = ctx.createProgram(this.resourcesRaw.solidColorVert.text, this.resourcesRaw.solidColorFrag.text);
        this.showNormals = ctx.createProgram(this.resourcesRaw.showNormalsVert.text, this.resourcesRaw.showNormalsFrag.text);
        this.showTexCoords = ctx.createProgram(this.resourcesRaw.showTexCoordsVert.text, this.resourcesRaw.showTexCoordsFrag.text);

        //var file = ASSETS_DIR + '/models/duck/duck.gltf';
        var file = ASSETS_DIR + '/models/rambler/Rambler.gltf';
        //var file = ASSETS_DIR + '/models/SuperMurdoch/SuperMurdoch.gltf';
        //var file = ASSETS_DIR + '/models/box/box.gltf';
        //var file = ASSETS_DIR + '/models/wine/wine.gltf';
        //var file = ASSETS_DIR + '/models/demo_collada_noanim/demo_collada_noanim.gltf';
        //var file = ASSETS_DIR + '/models/beeple/BigHead.gltf';
        //var file = ASSETS_DIR + '/models/beeple/HugePounder.gltf';
        //var file = ASSETS_DIR + '/models/beeple/SideSmasher.gltf';
        //var file = ASSETS_DIR + '/models/beeple/MEASURE_TWO.gltf';
        loadGLTF(ctx, file, function(err, scene) {
            if (err) {
                log('loadGLTF done', err);
                return;
            }
            log('loadGLTF done');

            this.scene = scene;
        }.bind(this));
    },
    nodesDrawn: 0,
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

        ctx.bindProgram(this.showNormals);
        this.showNormals.setUniform('uPointSize', 20);
        //ctx.bindProgram(this.showTexCoords);
        //this.showTexCoords.setUniform('uPointSize', 20);
        //ctx.bindProgram(this.solidColorProgram);
        //this.solidColorProgram.setUniform('uColor', [1, 0, 0, 1]);
        //var solidColorProgram = this.solidColorProgram;
        //this.solidColorProgram.setUniform('uPointSize', 20);

        random.seed(0);

        function drawMesh(json, meshInfo) {
            meshInfo.primitives.forEach(function(primitive) {
                var r = random.float();
                var g = random.float();
                var b = random.float();
                //solidColorProgram.setUniform('uColor', [r, g, b, 1]);

                var numVerts = json.accessors[primitive.indices].count;
                var positionAttrib = json.accessors[primitive.attributes.POSITION];
                var minPos = positionAttrib.min;
                var maxPos = positionAttrib.max;
                var size = Vec3.sub(Vec3.copy(maxPos), minPos);
                var center = Vec3.scale(Vec3.add(Vec3.copy(minPos), maxPos), -0.5);
                var scale = Math.max(size[0], Math.max(size[1], size[2]));
                ctx.pushModelMatrix();
                ctx.bindVertexArray(primitive.vertexArray);
                ctx.drawElements(ctx.TRIANGLES, numVerts, 0);
                ctx.popModelMatrix();
            }.bind(this))
        }

        var self = this;

        function drawNodes(json, nodes) {
            nodes.forEach(function(nodeInfo) {
                ctx.pushModelMatrix();
                if (nodeInfo.matrix) {
                    ctx.multMatrix(nodeInfo.matrix);
                }
                if (nodeInfo.rotation) {
                    //TODO: implement quat rotation
                    //ctx.multQuat(nodeInfo.rotation);
                }
                if (nodeInfo.scale) {
                    //TODO: check scale transform orer
                    ctx.scale(nodeInfo.scale);
                }
                if (nodeInfo.translation) {
                    ctx.translate(nodeInfo.translation)
                }
                if (nodeInfo.meshes) {
                    nodeInfo.meshes.forEach(function(meshId) {
                        var meshInfo = meshes[meshId];
                        drawMesh(json, meshInfo);
                    });
                }
                if (nodeInfo.children) {
                    drawNodes(json, nodeInfo.children);
                }
                ctx.popModelMatrix();
            });
        }

        if (this.scene) {
            var json = this.scene;
            var nodes = json.nodes;
            var meshes = json.meshes;
            drawNodes(json, json.scenes[json.scene].nodes)
        }

        this.gui.draw();
    }
})
