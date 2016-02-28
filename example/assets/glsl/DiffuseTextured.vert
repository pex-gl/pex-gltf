attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord0;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

varying vec3 ecNormal;

varying vec2 vTexCoord0;

uniform float uPointSize;
void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
    vTexCoord0 = aTexCoord0;
    ecNormal = uNormalMatrix * aNormal;

    gl_PointSize = uPointSize;
}
