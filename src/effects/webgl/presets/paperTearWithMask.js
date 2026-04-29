// Paper Tear With Mask Preset
export default {
    name: 'Paper Tear With Mask',
    description: 'Paper tear effect on cutout mask',
    filters: [
        {
            filterName: 'Mask Smoother', // Foreground mask smoother
            parameters: {
                sourceIdx: 0,
                smoothing: 3.4,
                maskInputChannel: 3,
                invertMask: 1,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Dilation', // Dilate the mask area
            parameters: {
                sourceIdx: -1,
                steps: 5,
                texelStep: 5,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Paper Tear Mask Generator', // Paper mask
            parameters: {
                sourceIdx: -1,
                horizontalMarginPixel: 25,
                verticalMarginPixel: 25,
                maxHorizontalMarginRatio: 0.15,
                maxVerticalMarginRatio: 0.15,
                noiseScale: 5.0,
                keep: 1,
                noiseIntensity: 1.3, 
                useInputAsBase: 1.0,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Mask Smoother', // Smoother
            parameters: {
                sourceIdx: -1,
                smoothing: 6.8,
                maskInputChannel: 0,
                invertMask: 0,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Mask Smoother', // Smoother
            parameters: {
                sourceIdx: -1,
                smoothing: 6.8,
                maskInputChannel: 0,
                invertMask: 0,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Irregular Edge', // Foreground irregular mask
            parameters: {
                sourceIdx: -1,
                threshold: 0.4,
                size: 200,
                size2: 100,
                ratio: 0.5,
                z: 36.17,
                noiseRange: 0.5,
                mode: 0,
                texelStep: 3,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Dilation', // Dilate the mask area
            parameters: {
                sourceIdx: 4,
                steps: 5,
                texelStep: 4,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Mask Smoother', // Smoother
            parameters: {
                sourceIdx: -1,
                smoothing: 6.8,
                maskInputChannel: 0,
                invertMask: 0,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Mask Smoother', // Smoother
            parameters: {
                sourceIdx: -1,
                smoothing: 4.3,
                maskInputChannel: 0,
                invertMask: 0,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Irregular Edge', // Paper mask
            parameters: {
                sourceIdx: -1,
                threshold: 0.4,
                size: 250,
                size2: 100,
                ratio: 0.5,
                z: 36.17,
                noiseRange: 0.7,
                mode: 0,
                texelStep: 3,
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        },
        {
            filterName: 'Paper Tear Combine',
            parameters: {
                applyBackgroundColor: 1.0,
                noiseOnForeground: 1.0,
                noiseStrength: 0.05,
                sourceIdx: 4, // Foreground
                texture2: 7, // Foreground irregular
                texture3: 11, // Paper
                texture4: 1, // Source image
                paperColor: [242.0 / 255.0, 242.0 / 255.0, 242.0 / 255.0, 1.0],
                backgroundColor: [0.0, 0.0, 0.0, 0.0],
                standardDimension: 1000.0,
                applyNormalization: 1
            }
        }
    ]
};
