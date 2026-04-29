// Mask Smoother Filter
// Applies a segmentation mask to isolate the foreground
export default {
    name: 'Mask Smoother',
    description: 'Smooth the mask',
    twoInput: true, // This filter requires two input textures
    
    parameters: {
        sourceIdx: {
            type: 'range',
            label: 'Source Idx',
            min: -1,
            max: 15,
            step: 1,
            default:  -1
        },
        smoothing: {
            type: 'range',
            label: 'Edge Smoothing',
            min: 0,
            max: 10,
            step: 0.1,
            default: 1.0
        },
        maskInputChannel: {
            type: 'range',
            label: 'Mask Input Channel',
            min: 0,
            max: 3,
            step: 1,
            default: 3
        },
        invertMask: {
            type: 'range',
            label: 'Invert mask',
            min: 0,
            max: 1,
            step: 1,
            default: 0
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
        uniform float smoothing;
        uniform float maskInputChannel;
        uniform float invertMask;
        uniform float standardDimension;
        uniform float applyNormalization;
        
        out vec4 fragColor;

        float getNormalizedFactor(vec2 resolution) {
            return applyNormalization > 0.0 ? max(resolution.x, resolution.y) / standardDimension : 1.0;
        }

        float getMaskValue(vec4 maskColor) {
            if (maskInputChannel < 1.0) {
                return maskColor.r;
            } else if (maskInputChannel < 2.0) {
                return maskColor.g;
            } else if (maskInputChannel < 3.0) {
                return maskColor.b;
            } else {
                return maskColor.a;
            }
        }
        
        void main() {
            vec2 texCoord = gl_FragCoord.xy / u_resolution;
            
            float normalizedFactor = getNormalizedFactor(u_resolution);
            
            // Get the mask alpha value
            vec4 maskColor = texture(u_image, texCoord);
            float mask = getMaskValue(maskColor);
            
            // Apply smoothing to the mask edges
            if (smoothing > 0.0) {
                // Sample neighboring pixels for smoothing
                float sum = 0.0;
                float count = 0.0;
                float radius = smoothing;
                vec2 pixelSize = normalizedFactor / u_resolution;

                int halfKernel = 5;

                for (int y = -halfKernel; y <= halfKernel; y++) {
                    for (int x = -halfKernel; x <= halfKernel; x++) {
                        vec2 offset = vec2(float(x), float(y)) * radius * pixelSize;
                        sum += getMaskValue(texture(u_image, texCoord + offset));
                        count += 1.0;
                    }
                }
                
                mask = sum / count;
            }

            // Output the mask value for all channels
            mask = invertMask < 1.0 ? mask : 1.0 - mask;
            fragColor = vec4(vec3(mask), 1.0);
        }
    `
};
