'use strict'

require('debug').enable('pex/*')

// TODO: try to create regl buffer from gltf mesh and display with solid color

const gl = require('pex-gl')(1280, 720)
const regl = require('regl')(gl)
const Mat4 = require('pex-math/Mat4')
const createCube = require('primitive-cube')
const glsl = require('glslify')
const log = require('debug')('pex/app')
const loadGlft = require('../../load')
const isBrowser = require('is-browser')
const lookup = require('gl-constants/lookup')

const cube = createCube()

const projectionMatrix = Mat4.perspective([], 60, 1280 / 720, 0.1, 100)
const viewMatrix = Mat4.lookAt([], [10, 10, 10], [0, 0, 0], [0, 1, 0])

const MODELS_DIR = (isBrowser ? '' : __dirname + '/') + 'assets/sampleModels'

const models = [
  // MODELS_DIR + '/Buggy/glTF/Buggy.gltf',
  MODELS_DIR + '/Rambler/glTF/Rambler.gltf',
  MODELS_DIR + '/Duck/glTF/Duck.gltf'
]

const AttributeSizeMap = {
  "SCALAR": 1,
  "VEC3": 3,
  "VEC2": 2
}

const WebGLConstants = {
  1: 'lines',
  4: 'triangles',
  5123: 'uint16',         // 0x1403
  5126: 'float'                   // 0x1406
}

const getReglConstant = function (glConstant) {
  if (WebGLConstants[glConstant]) {
    return WebGLConstants[glConstant]
  } else {
    console.log('Unknown constant', glConstant, lookup(glConstant))
    return null
  }
}

const vert = glsl`
  #ifdef GL_ES
  #pragma glslify: transpose = require(glsl-transpose)
  #endif
  #pragma glslify: inverse = require(glsl-inverse)

  attribute vec3 aPosition;
  attribute vec3 aNormal;

  uniform mat4 uProjectionMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uModelMatrix;

  varying vec3 vNormal;

  void main () {
    mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
    mat3 normalMatrix = mat3(transpose(inverse(modelViewMatrix)));
    vNormal = normalMatrix * aNormal;
    gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
  }
`

const frag = glsl`
  #ifdef GL_ES
  precision highp float;
  #endif

  varying vec3 vNormal;

  void main () {
    gl_FragColor.rgb = vNormal * 0.5 + 0.5;
    gl_FragColor.a = 1.0;
  }
`
const commandQueue = []

loadGlft(models[0], function (err, json) {
  if (err) {
    log(err)
    log(err.stack)
    if (!isBrowser) {
      process.exit(0)
    }
  }
  let meshIndex = 0
  function handleMesh (mesh, parentNode) {
    const parentStack = []
    let parent = parentNode
    while (parent) {
      if (parent.matrix) {
        // we will process matrices in reverse order
        // from parent to child
        parentStack.unshift(parent.matrix) 
      }
      parent = parent._parent
    }
    const modelMatrix = parentStack.reduce(
      (modelMatrix, m) => Mat4.mult(modelMatrix, m), Mat4.create()
    )
    meshIndex++
    if (meshIndex > 150) {
      return
    }
    mesh.primitives.forEach((primitive, primitiveIndex) => {
      console.log('meshIndex', meshIndex)

      var buffer = primitive.attributes.POSITION.bufferView._buffer
      var accessorInfo = primitive.attributes.POSITION
      var size = AttributeSizeMap[accessorInfo.type]
      var data = new Float32Array(buffer.slice(accessorInfo.byteOffset, accessorInfo.byteOffset + accessorInfo.count * size * 4))
      const attributes = {
        // aPosition: {
          // buffer: regl.buffer({
            // data: data,
            // type: getReglConstant(primitive.attributes.POSITION.componentType)
          // })
        // }
        aPosition: {
          buffer: regl.buffer({
            data: primitive.attributes.POSITION.bufferView._buffer,
            type: getReglConstant(primitive.attributes.POSITION.componentType)
          }),
          offset: primitive.attributes.POSITION.byteOffset,
          stride: primitive.attributes.POSITION.byteStride
        }
      }

      let normalAttrib = null
      if (primitive.attributes.NORMAL) {
        normalAttrib = primitive.attributes.NORMAL
      } else {
        // TODO: compute normals
        normalAttrib = primitive.attributes.POSITION
      }

      attributes.aNormal = {
        buffer: regl.buffer({
          data: normalAttrib.bufferView._buffer,
          type: getReglConstant(normalAttrib.componentType)
        }),
        offset: normalAttrib.byteOffset,
        stride: normalAttrib.byteStride
      }

      size = AttributeSizeMap[primitive.indices.type]
      const cmd = regl({
        attributes: attributes,
        elements: regl.elements({
          data: primitive.indices.bufferView._buffer,
          // data: new Uint16Array(primitive.indices.bufferView._buffer.slice(primitive.indices.byteOffset, primitive.indices.byteOffset + primitive.indices.count * size * 2 )),
          primitive: getReglConstant(primitive.primitive),
          type: getReglConstant(primitive.indices.componentType)
        }),
        vert: vert,
        frag: frag,
        uniforms: {
          uProjectionMatrix: projectionMatrix,
          uViewMatrix: viewMatrix,
          uModelMatrix: modelMatrix
        },
        count: primitive.indices.count,
        offset: primitive.indices.byteOffset / 2
      })
      commandQueue.push(cmd)
    })
  }

  function handleNode (node) {
    if (node.meshes) {
      node.meshes.forEach((mesh) => handleMesh(mesh, node))
    }
    node.children.forEach(handleNode)
  }

  json.scenes[json.scene].nodes.forEach(handleNode)
  console.log(regl.stats)
})

const drawCube = regl({
  attributes: {
    aPosition: cube.positions,
    aNormal: cube.normals
  },
  elements: cube.cells,
  vert: vert,
  frag: frag,
  uniforms: {
    uProjectionMatrix: projectionMatrix,
    uViewMatrix: viewMatrix,
    uModelMatrix: Mat4.create()
  }
})

regl.frame(() => {
  regl.clear({
    color: [0.2, 0.2, 0.2, 1],
    depth: 1
  })
  // drawCube()
  commandQueue.forEach((cmd) => cmd())
})
