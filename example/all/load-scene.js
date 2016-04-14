var loadGLTF      = require('../../');
var AABB          = require('pex-geom/AABB');
var Vec3          = require('pex-math/Vec3');
var Mat4          = require('pex-math/Mat4');

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

        if (primitive.material && self.drawingMode == 'diffuse') {
            var material = data.materials[primitive.material];
            //TODO: what is instanceTechnique?
            var values = material.values || material.instanceTechnique.values;
            if (values) {
                var diffuseTex = values.diffuse && data.textures && data.textures[values.diffuse];
                if (diffuseTex && diffuseTex._texture) {
                    ctx.bindProgram(self.diffuseTexturedProgram);
                    ctx.bindTexture(diffuseTex._texture, 0)
                }
                else if (Array.isArray(values.diffuse)) {
                    ctx.bindProgram(self.diffuseProgram);
                    self.diffuseProgram.setUniform('uColor', values.diffuse)
                }
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


function visitMeshes(renderer, parent, data, meshes) {
    meshes.forEach(function(meshId) {
        var meshInfo = data.meshes[meshId]; //TODO: this should resolve to ojbect
        meshInfo.primitives.forEach(function(primitive) {
            var positionAttrib = data.accessors[primitive.attributes.POSITION];
            var numVerts = data.accessors[primitive.indices].count
            var node = renderer.createMeshNode(primitive.vertexArray);
            node.count = numVerts;
            node.primitiveType = 0x0004; //ctx.TRIANGLES;

            parent._children.push(node);
            node._parent = parent;
            Mat4.mult(node._globalTransform, parent._globalTransform);

            var positionAttrib = data.accessors[primitive.attributes.POSITION];
            node.minPos = positionAttrib.min;
            node.maxPos = positionAttrib.max;

            if (primitive.material) {
                var material = data.materials[primitive.material];
                //TODO: what is instanceTechnique?
                var values = material.values || material.instanceTechnique.values;
                if (values) {
                    var diffuseTex = values.diffuse && data.textures && data.textures[values.diffuse];
                    if (diffuseTex && diffuseTex._texture) {
                        node.material._albedoColorTexture = diffuseTex._texture
                    }
                    else if (Array.isArray(values.diffuse)) {
                        //ctx.bindProgram(self.diffuseProgram);
                        //self.diffuseProgram.setUniform('uColor', values.diffuse)
                        node.material._albedoColor = values.diffuse
                    }
                }
            }
        })
    })
}

function updateTransforms(node) {
    //TODO: ugly, renderer does it anyway
    Mat4.identity(node._localTransform)
    Mat4.translate(node._localTransform, node._position);
    Mat4.mult(node._localTransform, Mat4.fromQuat(Mat4.create(), node._rotation));
    Mat4.scale(node._localTransform, node._scale);
    if (node._transform) { //TODO: required for GLTF
        Mat4.mult(node._localTransform, node._transform);
    }

    var parent = node._parent;
    var stack = [ node._localTransform ]
    while (parent) {
        stack.push(parent._localTransform)
        parent = parent._parent;
    }
    stack.reverse()
    stack.forEach(function(mat) {
        Mat4.mult(node._globalTransform, mat)
    })

    node._children.forEach(updateTransforms)
}

function visitNodes(renderer, parent, data, nodes) {
    nodes.forEach(function(nodeInfo) {
        var node = renderer.createNode();
        parent._children.push(node);
        node._parent = parent;

        if (nodeInfo.matrix) {
            node._transform = nodeInfo.matrix;
        }
        if (nodeInfo.rotation) {
            //TODO: implement quat rotation
            //ctx.multQuat(nodeInfo.rotation);
        }
        if (nodeInfo.scale) {
            Vec3.set(node._scale, nodeInfo.scale)
        }
        if (nodeInfo.translation) {
            Vec3.set(node._position, nodeInfo.translation)
        }

        if (nodeInfo.meshes) {
            visitMeshes(renderer, node, data, nodeInfo.meshes)
        }

        if (nodeInfo.children) {
            visitNodes(renderer, node, data, nodeInfo.children)
        }
    });
}

function calcBoundingBox(node, bbox, tmpPoint) {
    bbox = bbox || AABB.create();
    tmpPoint = tmpPoint || Vec3.create()
    if (node.mesh) {
        Vec3.set(tmpPoint, node.minPos);
        Vec3.multMat4(tmpPoint, node._globalTransform);
        AABB.includePoint(bbox, tmpPoint);

        Vec3.set(tmpPoint, node.maxPos);
        Vec3.multMat4(tmpPoint, node._globalTransform);
        AABB.includePoint(bbox, tmpPoint);
    }
    if (node._children) {
        node._children.forEach(function(child) {
            calcBoundingBox(child, bbox, tmpPoint)
        })
    }
    return bbox;
}

function loadScene(ctx, renderer, gltfFile, callback) {
    console.log('loadScene', gltfFile)
    loadGLTF(ctx, gltfFile, function(err, data) {
        if (err) {
            callback(err, null)
        }

        var scene = data.scenes[data.scene]
        var root = renderer.createNode();
        var subRoot = renderer.createNode();
        subRoot._parent = root;
        root._children.push(subRoot)

        visitNodes(renderer, subRoot, data, scene.nodes);

        updateTransforms(root)

        var bbox = calcBoundingBox(root)
        var sceneSize = AABB.size(bbox)
        var sceneCenter = AABB.center(bbox)
        var maxSize = Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2]));

        Vec3.set3(root._scale, 1 / maxSize, 1 / maxSize, 1 / maxSize);
        Vec3.set3(subRoot._position, -sceneCenter[0], -sceneCenter[1] + sceneSize[1]/2, -sceneCenter[2]);

        subRoot._bbox = bbox;

        callback(null, root);
    });
}

module.exports = loadScene;
