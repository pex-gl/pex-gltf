var Window        = require('pex-sys/Window');
var Draw          = require('pex-draw');
var glslify       = require('glslify-promise');
var PerspCamera   = require('pex-cam/PerspCamera');
var Arcball       = require('pex-cam/Arcball');
var GUI           = require('pex-gui');
var log           = require('debug')('main');
var debug         = require('debug')//.enable('*');
var loadGLTF      = require('../');
var isBrowser     = require('is-browser');
var Vec3          = require('pex-math/Vec3');
var iterateObject = require('iterate-object');
var Mat4          = require('pex-math/Mat4');
var mult44        = require('gl-mat4/multiply')
var random        = require('pex-random');
var AABB          = require('pex-geom/AABB');


var ASSETS_DIR    = isBrowser ? 'assets' : __dirname + '/assets';
var MODELS_DIR    = isBrowser ? 'glTF/sampleModels' : __dirname + '/glTF/sampleModels';

AABB.includePoint = function(a, p) {
    a[0][0] = Math.min(a[0][0], p[0])
    a[0][1] = Math.min(a[0][1], p[1])
    a[0][2] = Math.min(a[0][2], p[2])
    a[1][0] = Math.max(a[1][0], p[0])
    a[1][1] = Math.max(a[1][1], p[1])
    a[1][2] = Math.max(a[1][2], p[2])
    return a;
}

var MODELS = [
    '2_cylinder_engine',
    'CesiumMan',
    'CesiumMilkTruck',
    'Reciprocating_Saw',
    'RiggedFigure',
    'RiggedSimple',
    'box',
    'boxAnimated',
    'boxSemantics',
    'boxTextured',
    'boxWithoutIndices',
    'brainsteam',
    'buggy',
    'duck',
    'gearbox_assy',
    'monster',
    'vc',
]


Window.create({
    settings: {
        width: 1280,
        height: 720
    },
    resources: {
        showColorsVert    : { glsl : glslify(__dirname + '/assets/glsl/ShowColors.vert')},
        showColorsFrag    : { glsl : glslify(__dirname + '/assets/glsl/ShowColors.frag')},
        solidColorVert    : { glsl : glslify(__dirname + '/assets/glsl/SolidColor.vert')},
        solidColorFrag    : { glsl : glslify(__dirname + '/assets/glsl/SolidColor.frag')},
        showNormalsVert   : { glsl : glslify(__dirname + '/assets/glsl/ShowNormals.vert')},
        showNormalsFrag   : { glsl : glslify(__dirname + '/assets/glsl/ShowNormals.frag')},
        showTexCoordsVert : { glsl : glslify(__dirname + '/assets/glsl/ShowTexCoords.vert')},
        showTexCoordsFrag : { glsl : glslify(__dirname + '/assets/glsl/ShowTexCoords.frag')}
    },
    selectedModel: 'monster',
    sceneBBoxDirty: false,
    tmpPoint: Vec3.create(),
    tmpMatrix: Mat4.create(),
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.debugDraw = new Draw(ctx);

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.gui.addHeader('Options');
        this.addEventListener(this.gui);


        this.gui.addRadioList('Models', this, 'selectedModel', MODELS.map(function(name) {
            return { name: name, value: name }
        }), function(modelName) {
            this.loadModel(modelName);
        }.bind(this))


        this.camera  = new PerspCamera(45, this.getAspectRatio(), 0.01, 200.0);
        this.camera.lookAt([-2, 0.5, -2], [0, 0, 0], [0, 1, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());
        ctx.setViewMatrix(this.camera.getViewMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setRadiusScale(1.5);
        this.arcball.setSpeed(1);
        this.addEventListener(this.arcball);

        this.showColorsProgram = ctx.createProgram(res.showColorsVert, res.showColorsFrag);
        this.solidColorProgram = ctx.createProgram(res.solidColorVert, res.solidColorFrag);
        this.showNormals = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        this.showTexCoords = ctx.createProgram(res.showTexCoordsVert, res.showTexCoordsFrag);

        this.loadModel(this.selectedModel)
    },
    loadModel: function(modelName) {
        var ctx = this.getContext();
        var file = MODELS_DIR + '/' + modelName + '/glTF/' + modelName + '.gltf';
        loadGLTF(ctx, file, function(err, data) {
            if (err) {
                log('loadGLTF done', err);
                return;
            }
            log('loadGLTF done');

            this.data = data;
            this.scene = data.scenes[data.scene]
            this.sceneBBox = AABB.create();
            this.sceneSize = Vec3.create();
            this.sceneScale = 1;
            this.sceneCenter = Vec3.create();

            this.sceneBBoxDirty = true;
        }.bind(this), false);
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
        //ctx.bindProgram(this.solidColorProgram);
        //this.solidColorProgram.setUniform('uColor', [1, 0, 0, 1]);
        //var solidColorProgram = this.solidColorProgram;
        //this.solidColorProgram.setUniform('uPointSize', 20);

        var self = this;

        function drawMesh(data, meshInfo) {
            meshInfo.primitives.forEach(function(primitive) {
                var r = random.float();
                var g = random.float();
                var b = random.float();
                //solidColorProgram.setUniform('uColor', [r, g, b, 1]);

                var numVerts = data.accessors[primitive.indices].count;
                var positionAttrib = data.accessors[primitive.attributes.POSITION];
                var minPos = positionAttrib.min;
                var maxPos = positionAttrib.max;
                //var size = Vec3.sub(Vec3.copy(maxPos), minPos);
                //var center = Vec3.scale(Vec3.add(Vec3.copy(minPos), maxPos), -0.5);
                //var scale = Math.max(size[0], Math.max(size[1], size[2]));

                if (self.sceneBBoxDirty) {
                    ctx.getModelMatrix(self.tmpMatrix);

                    Vec3.set(self.tmpPoint, minPos);
                    Vec3.multMat4(self.tmpPoint, self.tmpMatrix);
                    AABB.includePoint(self.sceneBBox, self.tmpPoint);

                    Vec3.set(self.tmpPoint, maxPos);
                    Vec3.multMat4(self.tmpPoint, self.tmpMatrix);
                    AABB.includePoint(self.sceneBBox, self.tmpPoint);
                }
                else {
                    ctx.pushModelMatrix();
                    ctx.bindVertexArray(primitive.vertexArray);
                    ctx.drawElements(ctx.TRIANGLES, numVerts, 0);
                    ctx.popModelMatrix();
                }
            })
        }

        function drawNodes(data, nodes) {
            nodes.forEach(function(nodeInfo) {
                ctx.pushModelMatrix();
                if (nodeInfo.matrix) {
                    ctx.multMatrix(nodeInfo.matrix);
                }
                if (nodeInfo.rotation) {
                    //console.log(nodeInfo.rotation)
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
                        var meshInfo = data.meshes[meshId];
                        drawMesh(data, meshInfo);
                    });
                }
                if (nodeInfo.children) {
                    drawNodes(data, nodeInfo.children);
                }
                ctx.popModelMatrix();
            });
        }

        if (this.data) {
            if (this.sceneBBoxDirty) {
                drawNodes(this.data, this.scene.nodes)
                AABB.size(this.sceneBBox, this.sceneSize)
                AABB.center(this.sceneBBox, this.sceneCenter)
                var maxSize = Math.max(this.sceneSize[0], Math.max(this.sceneSize[1], this.sceneSize[2]));
                this.sceneScale = [1 / maxSize, 1 / maxSize, 1 / maxSize];
                this.sceneOffset = [ -this.sceneCenter[0], -this.sceneCenter[1] + this.sceneSize[1]/2, -this.sceneCenter[2]];
                this.sceneBBoxDirty = false;
            }
            else {
                ctx.pushModelMatrix()
                ctx.scale(this.sceneScale)
                ctx.translate(this.sceneOffset);
                drawNodes(this.data, this.scene.nodes)
                this.debugDraw.debugAABB(this.sceneBBox);
                ctx.popModelMatrix()
            }
        }

        this.gui.draw();
    }
})
