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
        this.camera.lookAt([0, 2, 2], [0, 0, 0], [0, 1, 0]);
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

        var file = ASSETS_DIR + '/models/duck/duck.gltf';
        //var file = ASSETS_DIR + '/models/rambler/Rambler.gltf';
        //var file = ASSETS_DIR + '/models/SuperMurdoch/SuperMurdoch.gltf';
        loadGLTF(ctx, file, function(err, scene) {
            if (err) {
                log('loadGLTF done', err);
                return;
            }
            log('loadGLTF done');

            this.scene = scene;
        }.bind(this));
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

        ctx.bindProgram(this.showNormals);
        this.showNormals.setUniform('uPointSize', 20);
        //ctx.bindProgram(this.showTexCoords);
        //this.showTexCoords.setUniform('uPointSize', 20);
        //ctx.bindProgram(this.showNormals);
        //this.solidColorProgram.setUniform('uColor', [1, 0, 0, 1]);
        //this.solidColorProgram.setUniform('uPointSize', 20);

        function drawMesh(meshInfo) {
            meshInfo.primitives.forEach(function(primitive) {
                var numVerts = scene.accessors[primitive.indices].count;
                var positionAttrib = scene.accessors[primitive.attributes.POSITION];
                var minPos = positionAttrib.min;
                var maxPos = positionAttrib.max;
                var size = Vec3.sub(Vec3.copy(maxPos), minPos);
                var center = Vec3.scale(Vec3.add(Vec3.copy(minPos), maxPos), -0.5);
                var scale = Math.max(size[0], Math.max(size[1], size[2]));
                ctx.pushModelMatrix();
                ctx.scale([1/scale, 1/scale, 1/scale]);
                ctx.translate(center);
                ctx.bindVertexArray(primitive.vertexArray);
                ctx.drawElements(ctx.TRIANGLES, numVerts, 0);
                ctx.popModelMatrix();
            })
        }

        if (this.scene) {
            var scene = this.scene;
            var nodes = scene.nodes;
            var meshes = scene.meshes;
            iterateObject(nodes, function(nodeInfo, nodeName) {
                var localMatrix = Mat4.create();
                //scale44(localMatrix, localMatrix, [2, -2, 2])
                //translate(localMatrix, localMatrix, [-2, 0, 0])
                var matrixStack = [nodeInfo.matrix];
                var parent = nodeInfo.parent;
                while(parent) {
                    if (parent.matrix) {
                        matrixStack.unshift(parent.matrix);
                    }
                    parent = parent.parent;
                }
                //matrixStack.forEach(function(mat) {
                //for(var i=matrixStack.length-1; i>=0; i--) {
                for(var i=0; i<matrixStack.length; i++) {
                    Mat4.mult(localMatrix, matrixStack[i]);
                }
                if (nodeInfo.meshes) {
                    ctx.pushModelMatrix();
                    ctx.setModelMatrix(localMatrix);
                    nodeInfo.meshes.forEach(function(meshId) {
                        var meshInfo = meshes[meshId];
                        drawMesh(meshInfo);
                    });
                    ctx.popModelMatrix();
                }
            });
        }

        this.gui.draw();
    }
})
