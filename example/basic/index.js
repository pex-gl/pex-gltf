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

const cube = createCube()

const projectionMatrix = Mat4.perspective([], 60, 1280 / 720, 0.1, 100)
const viewMatrix = Mat4.lookAt([], [3, 3, 3], [0, 0, 0], [0, 1, 0])
const modelMatrix = Mat4.create()

const MODELS_DIR = (isBrowser ? '' : __dirname + '/') + 'assets/sampleModels'

const models = [
  // MODELS_DIR + '/Buggy/glTF/Buggy.gltf',
  MODELS_DIR + '/Rambler/glTF/Rambler.gltf',
  MODELS_DIR + '/Duck/glTF/Duck.gltf'
]

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

loadGlft(models[0], function (err, scene) {
  if (err) {
    log(err)
    log(err.stack)
    if (!isBrowser) {
      process.exit(0)
    }
  }
  var meshes = Object.keys(scene.meshes).map((id) => scene.meshes[id])
  meshes.forEach((mesh, meshIndex) => {
    mesh.primitives.forEach((primitive, primitiveIndex) => {
      console.log('meshIndex', meshIndex)
      if (meshIndex > 30) {
        return
      }
      const attributes = {
        aPosition: {
          buffer: regl.buffer({
            data: primitive.attributes.POSITION.bufferView._buffer,
            type: 'float' // FIXME: guessed
          }),
          offset: primitive.attributes.POSITION.byteOffset * 0,
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
          type: 'float'// FIXME: guessed
        }),
        offset: normalAttrib.byteOffset * 0,
        stride: normalAttrib.byteStride
      }

      const cmd = regl({
        attributes: attributes,
        elements: regl.elements({
          data: primitive.indices.bufferView._buffer,
          primitive: 'triangle strip',
          type: 'uint16'// FIXME: guessed
        }),
        vert: vert,
        frag: frag,
        uniforms: {
          uProjectionMatrix: projectionMatrix,
          uViewMatrix: viewMatrix,
          uModelMatrix: modelMatrix
        }
      })
      commandQueue.push(cmd)
    })
  })
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
    uModelMatrix: modelMatrix
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
