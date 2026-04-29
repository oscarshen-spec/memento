// Dilation Filter
export default {
    name: 'Dilation',
    description: 'Expands bright regions in an image',
    
    parameters: {
        sourceIdx: {
            type: 'range',
            label: 'Source Idx',
            min: -1,
            max: 15,
            step: 1,
            default: -1
        },
        steps: {
            type: 'range',
            label: 'Steps',
            min: 0,
            max: 10,
            step: 1,
            default: 1
        },
        texelStep: {
            type: 'range',
            label: 'Texel Step',
            min: 0,
            max: 20,
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
        uniform float steps;
        uniform float texelStep;
        uniform float standardDimension;
        uniform float applyNormalization;
        
        out vec4 fragColor;

        float getNormalizedFactor(vec2 resolution) {
            return applyNormalization > 0.0 ? max(resolution.x, resolution.y) / standardDimension : 1.0;
        }
        
        void main() {
            vec2 texCoord = gl_FragCoord.xy / u_resolution;
            vec4 inputColor = texture(u_image, texCoord);
            vec4 maxValue = inputColor;

            float normalizedFactor = getNormalizedFactor(u_resolution);
            vec2 texelSize = normalizedFactor / u_resolution * texelStep;
            
            // Sample surrounding pixels
            for (int i = 0; i < int(steps); ++i) {
                vec4 value = texture(u_image, texCoord + float(i) * texelSize * vec2(-1.0, -1.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2( 0.0, -1.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2( 1.0, -1.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2(-1.0,  0.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2( 1.0,  0.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2(-1.0,  1.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2( 0.0,  1.0));
                maxValue = max(maxValue, value);
                value = texture(u_image, texCoord + float(i) * texelSize * vec2( 1.0,  1.0));
                maxValue = max(maxValue, value);
            }

            fragColor = maxValue;
        }
    `
};
