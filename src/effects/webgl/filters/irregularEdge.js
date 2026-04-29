// Irregular Edge Filter
export default {
    name: 'IrregularEdge',
    description: 'Create the irregular edge around the mask area',
    
    parameters: {
        sourceIdx: {
            type: 'range',
            label: 'Source Idx',
            min: -1,
            max: 15,
            step: 1,
            default: -1
        },
        threshold: {
            type: 'range',
            label: 'Threshold',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.4
        },
        size: {
            type: 'range',
            label: 'Size',
            min: 1,
            max: 500,
            step: 1,
            default: 200
        },
        size2: {
            type: 'range',
            label: 'Size2',
            min: 1,
            max: 500,
            step: 1,
            default: 100
        },
        ratio: {
            type: 'range',
            label: 'Ratio',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.5
        },
        z: {
            type: 'range',
            label: 'Z',
            min: 1,
            max: 100,
            step: 0.01,
            default: 36.17
        },
        noiseRange: {
            type: 'range',
            label: 'Noise Range',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.5
        },
        mode: {
            type: 'range',
            label: 'Mode',
            min: 0,
            max: 2,
            step: 1,
            default: 0
        },
        texelStep: {
            type: 'range',
            label: 'Texel Step',
            min: 1,
            max: 10,
            step: 1,
            default: 3
        },
        standardDimension: {
            type: 'float',
            lable: 'Standard Dimension',
            min: 500,
            max: 4096,
            step: 1,
            default: 1000
        },
        applyNormalization: {
            type: 'float',
            lable: 'Apply Normalization',
            min: 0,
            max: 1,
            step: 1,
            default: 1
        }
    },
    
    fragmentShader: `#version 300 es
        precision mediump float;
        
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float threshold;
        uniform float size;
        uniform float size2;
        uniform float ratio;
        uniform float z;
        uniform float noiseRange;
        uniform float mode;
        uniform float texelStep;
        uniform float standardDimension;
        uniform float applyNormalization;
        
        out vec4 fragColor;

        float getNormalizedFactor(vec2 resolution) {
            return applyNormalization > 0.0 ? max(resolution.x, resolution.y) / standardDimension : 1.0;
        }

        vec3 random3(vec3 c) {
            float j = 4096.0 * sin(dot(c, vec3(17.0, 59.4, 15.0)));
            vec3 r;
            r.z = fract(512.0 * j);
            j *= .125;
            r.x = fract(512.0 * j);
            j *= .125;
            r.y = fract(512.0 * j);
            return r - 0.5;
        }

        // Gaussian blur -> softLight with noise -> thresholding
        /* skew constants for 3d simplex functions */
        /* 3d simplex noise */
        float simplex3d(vec3 p) {
            float F3 =  0.3333333;
            float G3 =  0.1666667;
            /* 1. find current tetrahedron T and it's four vertices */
            /* s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices */
            /* x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertices*/

            /* calculate s and x */
            vec3 s = floor(p + dot(p, vec3(F3)));
            vec3 x = p - s + dot(s, vec3(G3));

            /* calculate i1 and i2 */
            vec3 e = step(vec3(0.0), x - x.yzx);
            vec3 i1 = e*(1.0 - e.zxy);
            vec3 i2 = 1.0 - e.zxy*(1.0 - e);

            /* x1, x2, x3 */
            vec3 x1 = x - i1 + G3;
            vec3 x2 = x - i2 + 2.0*G3;
            vec3 x3 = x - 1.0 + 3.0*G3;

            /* 2. find four surflets and store them in d */
            vec4 w, d;

            /* calculate surflet weights */
            w.x = dot(x, x);
            w.y = dot(x1, x1);
            w.z = dot(x2, x2);
            w.w = dot(x3, x3);

            /* w fades from 0.6 at the center of the surflet to 0.0 at the margin */
            w = max(0.6 - w, 0.0);

            /* calculate surflet components */
            d.x = dot(random3(s), x);
            d.y = dot(random3(s + i1), x1);
            d.z = dot(random3(s + i2), x2);
            d.w = dot(random3(s + 1.0), x3);

            /* multiply d by w^4 */
            w *= w;
            w *= w;
            d *= w;

            /* 3. return the sum of the four surflets */
            return dot(d, vec4(52.0));
        }

        /* directional artifacts can be reduced by rotating each octave */
        float simplex3d_fractal(vec3 m) {
            mat3 rot1 = mat3(-0.37, 0.36, 0.85, -0.14, -0.93, 0.34, 0.92, 0.01, 0.4);
            mat3 rot2 = mat3(-0.55, -0.39, 0.74, 0.33, -0.91, -0.24, 0.77, 0.12, 0.63);
            mat3 rot3 = mat3(-0.71, 0.52, -0.47, -0.08, -0.72, -0.68, -0.7, -0.45, 0.56);
            
            return   0.5333333 * simplex3d(m * rot1)
                    +0.2666667 * simplex3d(2.0 * m * rot2)
                    +0.1333333 * simplex3d(4.0 * m * rot3)
                    +0.0666667 * simplex3d(8.0 * m);
        }

        vec4 softLight(vec4 base, vec4 overlay) {
            float alphaDivisor = base.a + step(base.a, 0.0); // Protect against a divide-by-zero blacking out things in the output

            return base * (overlay.a * (base / alphaDivisor) + (2.0 * overlay * (1.0 - (base / alphaDivisor)))) + overlay * (1.0 - base.a) + base * (1.0 - overlay.a);
        }
        
        void main() {
            float normalizedFactor = getNormalizedFactor(u_resolution);

            vec2 texCoord = floor(gl_FragCoord.xy / normalizedFactor) / floor(u_resolution / normalizedFactor);
            vec4 inputColor = texture(u_image, texCoord);

            vec2 texelSize = normalizedFactor / u_resolution * texelStep;

            // Blur the mask
            float maskColor = texture(u_image, texCoord).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2(-1.0, -1.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2( 0.0, -1.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2( 1.0, -1.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2(-1.0,  0.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2( 1.0,  0.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2(-1.0,  1.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2( 0.0,  1.0)).r;
            maskColor += texture(u_image, texCoord + texelSize * vec2( 1.0,  1.0)).r;

            maskColor /= 9.0;

            // Factor
            vec3 p3 = vec3(texCoord * size, z);
            // Noise
            float value = simplex3d_fractal(p3*7.0+9.0);
            value = (1.0 - noiseRange) + noiseRange*value;
            
            float outputValue = maskColor;
            outputValue = softLight(vec4(vec3(outputValue), 1.0), vec4(vec3(value), 1.0)).r;
            
            outputValue = mix(0.0, 1.0, step(threshold, outputValue));
            outputValue = mix(outputValue, mix(0.0, maskColor, step(threshold, value)), mod(mode, 2.0));
            
            // Factor
            p3 = vec3(texCoord * size2, z);
            // Noise
            float value2 = simplex3d_fractal(p3*7.0+9.0);
            value2 = (1.0 - noiseRange) + noiseRange*value2;
            
            float outputValue2 = maskColor;
            outputValue2 = softLight(vec4(vec3(outputValue2), 1.0), vec4(vec3(value2), 1.0)).r;

            outputValue2 = mix(0.0, 1.0, step(threshold, outputValue2));
            outputValue2 = mix(outputValue2, mix(0.0, maskColor, step(threshold, value2)), mod(mode, 2.0));
            
            // Merge ratio
            float mergeRatio = clamp((abs(sin(texCoord.x * 17.314)) + abs(cos(texCoord.y * 14.925))) * ratio, 0.0, 1.0);
            outputValue = mix(outputValue, mix(outputValue, outputValue2, mergeRatio), step(2.0, mode));
            fragColor = vec4(outputValue, outputValue, outputValue, inputColor.a);
        }
    `
};
