#ifdef GL_ES
precision highp float;
#endif

varying vec3 ecNormal;
varying vec2 vTexCoord0;

uniform sampler2D uTexture;

void main() {

    vec3 N = normalize(ecNormal);
    vec3 L = normalize(vec3(10.0, 10.0, 10.0));
    float NdotL = max(0.0, dot(N, L));
    float wrap = 1.0;

    gl_FragColor.rgb = texture2D(uTexture, vTexCoord0).rgb * (NdotL + wrap)/(1.0 + wrap);
    gl_FragColor.a = 1.0;
}
