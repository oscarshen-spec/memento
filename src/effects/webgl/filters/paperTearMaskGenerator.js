// Paper Tear Mask Generator
export default {
    name: 'Paper Tear Mask Generator',
    description: 'Apply irregular edge around the image',
    
    parameters: {
        sourceIdx: {
            type: 'range',
            label: 'Source Idx',
            min: -1,
            max: 15,
            step: 1,
            default:  -1
        },
        horizontalMarginPixel: {
            type: 'range',
            label: 'HorizontalMarginPixel',
            min: 1,
            max: 100,
            step: 1,
            default: 25
        },
        verticalMarginPixel: {
            type: 'range',
            label: 'VerticalMarginPixel',
            min: 1,
            max: 100,
            step: 1,
            default: 25
        },
        maxHorizontalMarginRatio: {
            type: 'range',
            label: 'MaxHorizontalMarginRatio',
            min: 0.0,
            max: 0.4,
            step: 0.01,
            default: 0.15
        },
        maxVerticalMarginRatio: {
            type: 'range',
            label: 'MaxVerticalMarginRatio',
            min: 0.0,
            max: 0.4,
            step: 0.01,
            default: 0.15
        },
        noiseScale: {
            type: 'range',
            label: 'NoiseScale',
            min: 0.1,
            max: 10,
            step: 0.01,
            default: 5.0
        },
        keep: {
            type: 'range',
            lable: 'Keep',
            min: 0,
            max: 1,
            step: 1,
            default: 1
        },
        noiseIntensity: {
            type: 'range',
            label: 'NoiseIntensity',
            min: 0.1,
            max: 10.0,
            step: 0.01,
            default: 1.7
        },
        useInputAsBase: {
            type: 'range',
            label: 'Use Input As Base',
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
        
        uniform sampler2D inputTexture;
        uniform vec2 u_resolution;
        uniform float horizontalMarginPixel;
        uniform float verticalMarginPixel;
        uniform float maxHorizontalMarginRatio;
        uniform float maxVerticalMarginRatio;
        uniform float noiseScale;
        uniform float keep;
        uniform float noiseIntensity;
        uniform float useInputAsBase;
        uniform float standardDimension;
        uniform float applyNormalization;
        
        out vec4 fragColor;

        float getNormalizedFactor(vec2 resolution) {
            return applyNormalization > 0.0 ? max(resolution.x, resolution.y) / standardDimension : 1.0;
        }

        uint hash(uint x, uint seed) {
            const uint m = 0x5bd1e995U;
            uint hash = seed;
            // process input
            uint k = x;
            k *= m;
            k ^= k >> 24;
            k *= m;
            hash *= m;
            hash ^= k;
            // some final mixing
            hash ^= hash >> 13;
            hash *= m;
            hash ^= hash >> 15;
            return hash;
        }

        // implementation of MurmurHash for a 2-dimensional unsigned integer input vector.

        uint hash(uvec2 x, uint seed){
            const uint m = 0x5bd1e995U;
            uint hash = seed;
            // process first vector element
            uint k = x.x;
            k *= m;
            k ^= k >> 24;
            k *= m;
            hash *= m;
            hash ^= k;
            // process second vector element
            k = x.y;
            k *= m;
            k ^= k >> 24;
            k *= m;
            hash *= m;
            hash ^= k;
            // some final mixing
            hash ^= hash >> 13;
            hash *= m;
            hash ^= hash >> 15;
            return hash;
        }

        vec2 gradientDirection(uint hash) {
            switch (int(hash) & 3) { // look at the last two bits to pick a gradient direction
            case 0:
                return vec2(1.0, 1.0);
            case 1:
                return vec2(-1.0, 1.0);
            case 2:
                return vec2(1.0, -1.0);
            default:
                return vec2(-1.0, -1.0);
            }
        }

        float interpolate(float value1, float value2, float value3, float value4, vec2 t) {
            return mix(mix(value1, value2, t.x), mix(value3, value4, t.x), t.y);
        }

        vec2 fade(vec2 t) {
            // 6t^5 - 15t^4 + 10t^3
            return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
        }

        float perlinNoise(vec2 position, uint seed) {
            vec2 floorPosition = floor(position);
            vec2 fractPosition = position - floorPosition;
            uvec2 cellCoordinates = uvec2(floorPosition);
            float value1 = dot(gradientDirection(hash(cellCoordinates, seed)), fractPosition);
            float value2 = dot(gradientDirection(hash((cellCoordinates + uvec2(1, 0)), seed)), fractPosition - vec2(1.0, 0.0));
            float value3 = dot(gradientDirection(hash((cellCoordinates + uvec2(0, 1)), seed)), fractPosition - vec2(0.0, 1.0));
            float value4 = dot(gradientDirection(hash((cellCoordinates + uvec2(1, 1)), seed)), fractPosition - vec2(1.0, 1.0));
            return interpolate(value1, value2, value3, value4, fade(fractPosition));
        }

        float perlinNoise(vec2 position, int frequency, int octaveCount, float persistence, float lacunarity, uint seed) {
            float value = 0.0;
            float amplitude = 1.0;
            float currentFrequency = float(frequency);
            uint currentSeed = seed;
            for (int i = 0; i < octaveCount; i++) {
                currentSeed = hash(currentSeed, 0x0U); // create a new seed for each octave
                value += perlinNoise(position * currentFrequency, currentSeed) * amplitude;
                amplitude *= persistence;
                currentFrequency *= lacunarity;
            }
            return value;
        }
        
        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution;
            vec4 inputColor = texture(inputTexture, uv);

            float normalizedFactor = getNormalizedFactor(u_resolution);

            float horizontalMarginRatio = horizontalMarginPixel * normalizedFactor / u_resolution.x;
            float verticalMarginRatio = verticalMarginPixel * normalizedFactor / u_resolution.y;

            if (horizontalMarginRatio > maxHorizontalMarginRatio) {
                horizontalMarginRatio = maxHorizontalMarginRatio;
            }
            if (verticalMarginRatio > maxVerticalMarginRatio) {
                verticalMarginRatio = maxVerticalMarginRatio;
            }

            if (keep > 0.0) {
                float minMarginPixel = min(horizontalMarginRatio * float(u_resolution.x), verticalMarginRatio * float(u_resolution.y));
                horizontalMarginRatio = minMarginPixel / u_resolution.x;
                verticalMarginRatio = minMarginPixel / u_resolution.y;
            }

            float aspectRatio = u_resolution.x / u_resolution.y;
            
            vec4 maskColor = useInputAsBase > 0.0 ? vec4(inputColor.r, inputColor.r, inputColor.r, 1.0) : vec4(1.0);
            vec4 defaultColor = vec4(0.0);
            float ratio = 1.0;
            
            ratio *= smoothstep(0.0, horizontalMarginRatio, uv.x);
            ratio *= smoothstep(1.0, 1.0 - horizontalMarginRatio, uv.x);
            ratio *= smoothstep(0.0, verticalMarginRatio, uv.y);
            ratio *= smoothstep(1.0, 1.0 - verticalMarginRatio, uv.y);

            float sourceValue = useInputAsBase > 0.0 ? inputColor.r : 1.0;
            
            if (ratio == 1.0) {
                fragColor = maskColor;
            } else {
                vec2 position = uv * noiseScale;
                position.x *= aspectRatio;
                uint seed = 0x578437adU;
                float value = perlinNoise(position, 1, 6, 0.5, 2.0, seed);
                value = (value + 1.0) * 0.5;
                
                fragColor = mix(defaultColor, maskColor, step(0.5, value * ratio * noiseIntensity));
            }
        }
    `
};
