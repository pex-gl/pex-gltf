# pex-gltf

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

glTF loader for the pex library

## Usage

```
npm install pex-gltf --save
```

```javascript
var loadGLTF = require('pex-gltf');

loadGLTF('scene.gltf', function(err, data) {
    if (!err) {
        //data.meshes
        //data.scenes
        //...
    }
})
```

### Running the example code

Download the Khronos Group glTF repository containing example models (warning: it's 500MB) either by clonning the [glTF repository](https://github.com/KhronosGroup/glTF):

```
cd example
git clone https://github.com/KhronosGroup/glTF
```

or by downloading [the ZIP copy](https://github.com/KhronosGroup/glTF/archive/master.zip) and unpacking it into `pex-gltf/example/glTF`

## License

MIT, see [LICENSE.md](http://github.com/vorg/pex-gltf/blob/master/LICENSE.md) for details.
