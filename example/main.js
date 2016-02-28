var Window        = require('pex-sys/Window');
var Draw          = require('pex-draw');
var glslify       = require('glslify-promise');
var PerspCamera   = require('pex-cam/PerspCamera');
var Arcball       = require('pex-cam/Arcball');
var GUI           = require('pex-gui');
var log           = require('debug')('main');
var debug         = require('debug').enable('*');
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
    '2_cylinder_engine/glTF/2_cylinder_engine.gltf',
    'box/glTF/box.gltf',
    'boxAnimated/glTF/glTF.gltf',
    'boxSemantics/glTF/boxSemantics.gltf',//TODO: fill bug fix on glTF repo
    'boxTextured/glTF/CesiumTexturedBoxTest.gltf', //doesn't show textures on the other sides??
    //'boxWithoutIndices/glTF/boxWithoutIndices.gltf', //TODO: embedded only, fill bug fix on glTFL repo
    'brainsteam/glTF/brainsteam.gltf',
    'buggy/glTF/buggy.gltf',
    'CesiumMan/glTF/Cesium_Man.gltf',
    'CesiumMilkTruck/glTF/CesiumMilkTruck.gltf',
    'duck/glTF/duck.gltf',
    'gearbox_assy/glTF/gearbox_assy.gltf',
    'monster/glTF/monster.gltf',
    'Reciprocating_Saw/glTF/Reciprocating_Saw.gltf',
    'RiggedFigure/glTF/rigged-figure.gltf',
    'RiggedSimple/glTF/RiggedSimple.gltf',
    'vc/glTF/vc.gltf'
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
        showTexCoordsFrag : { glsl : glslify(__dirname + '/assets/glsl/ShowTexCoords.frag')},
        texturedVert      : { glsl : glslify(__dirname + '/assets/glsl/Textured.vert')},
        texturedFrag      : { glsl : glslify(__dirname + '/assets/glsl/Textured.frag')},
        diffuseVert      : { glsl : glslify(__dirname + '/assets/glsl/Diffuse.vert')},
        diffuseFrag      : { glsl : glslify(__dirname + '/assets/glsl/Diffuse.frag')},
        diffuseTexturedVert      : { glsl : glslify(__dirname + '/assets/glsl/DiffuseTextured.vert')},
        diffuseTexturedFrag      : { glsl : glslify(__dirname + '/assets/glsl/DiffuseTextured.frag')},
        checkerImage      : { image: ASSETS_DIR + '/textures/checker.png' }
    },
    selectedModel: 'duck/glTF/duck.gltf',
    sceneBBoxDirty: false,
    tmpPoint: Vec3.create(),
    tmpMatrix: Mat4.create(),
    drawingMode: 'diffuse',
    init: function() {
        var ctx = this.getContext();
        var res = this.getResources();

        this.debugDraw = new Draw(ctx);

        this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.gui.addHeader('Options');
        this.addEventListener(this.gui);

        this.gui.addRadioList('Drawing Mode', this, 'drawingMode', [
            { name: 'Show normals', value: 'normals' },
            { name: 'Show texCoords', value: 'texCoords' },
            { name: 'Diffuse', value: 'diffuse' }
        ])

        this.gui.addRadioList('Models', this, 'selectedModel', MODELS.map(function(modelFile) {
            return { name: modelFile.split('/')[0], value: modelFile }
        }), function(modelName) {
            this.loadModel(modelName);
        }.bind(this))

        this.camera  = new PerspCamera(45, this.getAspectRatio(), 0.01, 200.0);
        this.camera.lookAt([1.5, 1, -1.5], [0, 0.25, 0], [0, 1, 0]);
        ctx.setProjectionMatrix(this.camera.getProjectionMatrix());
        ctx.setViewMatrix(this.camera.getViewMatrix());

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.arcball.setRadiusScale(1.5);
        this.arcball.setSpeed(1);
        this.addEventListener(this.arcball);

        this.showColorsProgram = ctx.createProgram(res.showColorsVert, res.showColorsFrag);
        this.solidColorProgram = ctx.createProgram(res.solidColorVert, res.solidColorFrag);
        this.showNormalsProgram = ctx.createProgram(res.showNormalsVert, res.showNormalsFrag);
        this.showTexCoordsProgram = ctx.createProgram(res.showTexCoordsVert, res.showTexCoordsFrag);
        this.texturedProgram = ctx.createProgram(res.texturedVert, res.texturedFrag);
        this.diffuseProgram = ctx.createProgram(res.diffuseVert, res.diffuseFrag);
        this.diffuseTexturedProgram = ctx.createProgram(res.diffuseTexturedVert, res.diffuseTexturedFrag);

        this.checkerTex = ctx.createTexture2D(res.checkerImage)

        this.loadModel(this.selectedModel)
    },
    loadModel: function(model) {
        var ctx = this.getContext();
        var file = MODELS_DIR + '/' + model;
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

        switch(this.drawingMode) {
            case 'normals': ctx.bindProgram(this.showNormalsProgram); break;
            case 'texCoords': ctx.bindProgram(this.showTexCoordsProgram); break;
            case 'diffuse': ctx.bindProgram(this.texturedProgram); break;
        }

        var self = this;

        function drawMesh(data, meshInfo) {
            ctx.bindTexture(self.checkerTex, 0);

            meshInfo.primitives.forEach(function(primitive) {
                var r = random.float();
                var g = random.float();
                var b = random.float();
                //solidColorProgram.setUniform('uColor', [r, g, b, 1]);

                var numVerts = data.accessors[primitive.indices].count;
                var positionAttrib = data.accessors[primitive.attributes.POSITION];
                var minPos = positionAttrib.min;
                var maxPos = positionAttrib.max;

                if (primitive.material && self.drawingMode == 'diffuse') {
                    var material = data.materials[primitive.material];
                    var diffuseTex = material.values.diffuse && data.textures && data.textures[material.values.diffuse];
                    if (diffuseTex && diffuseTex._texture) {
                        ctx.bindProgram(self.diffuseTexturedProgram);
                        ctx.bindTexture(diffuseTex._texture, 0)
                    }
                    else if (Array.isArray(material.values.diffuse)) {
                        ctx.bindProgram(self.diffuseProgram);
                        self.diffuseProgram.setUniform('uColor', material.values.diffuse)
                    }
                }

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
                ctx.scale(this.sceneScale);
                ctx.translate(this.sceneOffset);

                drawNodes(this.data, this.scene.nodes);

                ctx.bindProgram(this.showColorsProgram);
                this.debugDraw.debugAABB(this.sceneBBox);

                ctx.popModelMatrix()
            }
        }

        this.gui.draw();
    }
})
