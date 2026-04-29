import WebGLRenderer from './WebGLRenderer.js';
import ExecutionContext from './ExecutionContext.js';

/**
 * FilterEngine - Manages filter pipeline execution
 * Orchestrates multi-pass rendering and returns base64 results
 * Main API for external developers to apply filters to images
 * Now supports both filter-based and effect-based presets
 */
export default class FilterEngine {
    constructor(canvas) {
        this.canvas = canvas || this.createCanvas();
        this.renderer = new WebGLRenderer(this.canvas);
        this.filters = {};
        this.presets = {};
        this.effects = {};  // NEW: Effect registry
    }

    /**
     * Create an offscreen canvas if none provided
     * @returns {HTMLCanvasElement}
     */
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        return canvas;
    }

    /**
     * Register a filter
     * @param {string} name - Filter name
     * @param {Object} filterDefinition - Filter definition with fragmentShader and parameters
     */
    registerFilter(name, filterDefinition) {
        this.filters[name] = filterDefinition;
    }

    /**
     * Register multiple filters at once
     * @param {Object} filtersObject - Object with filter names as keys
     */
    registerFilters(filtersObject) {
        Object.entries(filtersObject).forEach(([name, definition]) => {
            this.registerFilter(name, definition);
        });
    }

    /**
     * Register a preset
     * @param {string} name - Preset name
     * @param {Object} presetDefinition - Preset definition with filters array
     */
    registerPreset(name, presetDefinition) {
        this.presets[name] = presetDefinition;
    }

    /**
     * Register multiple presets at once
     * @param {Object} presetsObject - Object with preset names as keys
     */
    registerPresets(presetsObject) {
        Object.entries(presetsObject).forEach(([name, definition]) => {
            this.registerPreset(name, definition);
        });
    }

    /**
     * Register an effect class
     * @param {string} name - Effect name
     * @param {Class} EffectClass - Effect class (extends BaseEffect)
     */
    registerEffect(name, EffectClass) {
        this.effects[name] = EffectClass;
        console.log(`✅ Effect registered: ${name}`);
    }

    /**
     * Register multiple effects at once
     * @param {Object} effectsObject - Object with effect names as keys and classes as values
     */
    registerEffects(effectsObject) {
        Object.entries(effectsObject).forEach(([name, EffectClass]) => {
            this.registerEffect(name, EffectClass);
        });
    }

    /**
     * Load a LUT texture from the resources folder by filename
     * @param {string} filename - The LUT texture filename (e.g., 'Fuji Film.png')
     * @returns {Promise<WebGLTexture>} WebGL texture
     */
    async loadLutTexture(filename) {
        const lutPath = `resources/look-up-textures/${filename}`;
        const img = await this.loadImage(lutPath);
        return this.renderer.createTexture(img);
    }

    /**
     * Load image from various sources
     * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} imageSource
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImage(imageSource) {
        if (imageSource instanceof HTMLImageElement) {
            return imageSource;
        }

        if (imageSource instanceof HTMLCanvasElement) {
            // Convert canvas to image
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = imageSource.toDataURL();
            });
        }

        if (imageSource instanceof File || imageSource instanceof Blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(imageSource);
            });
        }

        if (typeof imageSource === 'string') {
            // Assume it's a URL or base64
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = imageSource;
            });
        }

        throw new Error('Unsupported image source type');
    }

    /**
     * Convert canvas to base64 data URL
     * @param {string} format - Image format (default: 'image/png')
     * @param {number} quality - Image quality for lossy formats (0-1)
     * @returns {string} Base64 data URL
     */
    toBase64(format = 'image/png', quality = 1.0) {
        return this.canvas.toDataURL(format, quality);
    }

    /**
     * Resize canvas based on image and max dimensions
     * @param {HTMLImageElement} image
     * @param {number} maxDimension - Maximum width or height
     */
    resizeCanvasToImage(image, maxDimension = 800) {
        let width = image.width;
        let height = image.height;
        
        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }
        }
        
        this.renderer.resizeCanvas(width, height);
    }

    /**
     * Apply a filter pipeline to an image
     * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} imageSource - Image to process
     * @param {Array<Object>} filterPipeline - Array of filter configurations
     * @param {Object} options - Additional options
     * @param {Array<HTMLCanvasElement>} options.additionalTextures - Additional textures for multi-input filters
     * @param {number} options.maxDimension - Maximum canvas dimension
     * @param {string} options.outputFormat - Output format (default: 'image/png')
     * @param {number} options.outputQuality - Output quality for lossy formats (0-1)
     * @returns {Promise<string>} Base64 data URL of the processed image
     */
    async applyFilters(imageSource, filterPipeline = [], options = {}) {
        try {
            // Load the source image
            const sourceImage = await this.loadImage(imageSource);
            
            // Resize canvas to match image
            const maxDimension = options.maxDimension || 800;
            this.resizeCanvasToImage(sourceImage, maxDimension);
            
            // Create source texture
            const sourceTexture = this.renderer.createTexture(sourceImage);
            
            // Create textures from additional inputs (e.g., segmentation masks)
            const additionalWebGLTextures = [];
            if (options.additionalTextures && options.additionalTextures.length > 0) {
                for (const textureSource of options.additionalTextures) {
                    additionalWebGLTextures.push(this.renderer.createTexture(textureSource));
                }
            }
            
            // If no filters, just render the source
            if (!filterPipeline || filterPipeline.length === 0) {
                const gl = this.renderer.getContext();
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                
                // Use a simple passthrough shader
                const passthroughShader = `#version 300 es
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
out vec4 fragColor;
void main() {
    vec2 texCoord = gl_FragCoord.xy / u_resolution;
    fragColor = texture(u_image, texCoord);
}`;
                
                this.renderer.renderPass(sourceTexture, passthroughShader, {}, []);
                
                // Clean up
                gl.deleteTexture(sourceTexture);
                additionalWebGLTextures.forEach(tex => gl.deleteTexture(tex));
                
                return this.toBase64(options.outputFormat, options.outputQuality);
            }
            
            // Store all stage textures for multi-input filters
            // Stage 0: additional textures (if any), then source texture
            const stageTextures = [...additionalWebGLTextures, sourceTexture];
            
            // Create framebuffers for intermediate results
            const framebuffers = [];
            for (let i = 0; i < filterPipeline.length; i++) {
                framebuffers.push(this.renderer.createFramebuffer(this.canvas.width, this.canvas.height));
            }
            
            const gl = this.renderer.getContext();
            let currentInputTexture = sourceTexture;
            
            // Execute filter pipeline
            for (let i = 0; i < filterPipeline.length; i++) {
                const filterConfig = filterPipeline[i];
                const filter = this.filters[filterConfig.filterName];
                
                if (!filter) {
                    console.warn(`Filter "${filterConfig.filterName}" not found, skipping`);
                    continue;
                }
                
                const isLastFilter = i === filterPipeline.length - 1;
                const outputFramebuffer = isLastFilter ? null : framebuffers[i].framebuffer;
                
                // Determine source texture based on sourceIdx parameter
                const sourceIdx = filterConfig.parameters?.sourceIdx ?? -1;
                if (sourceIdx >= 0 && sourceIdx < stageTextures.length) {
                    currentInputTexture = stageTextures[sourceIdx];
                }
                
                // Prepare additional textures for multi-input filters
                const renderAdditionalTextures = [];
                if (filter.twoInput && filterConfig.parameters?.texture2 !== undefined) {
                    const texture2Idx = Math.floor(filterConfig.parameters.texture2);
                    if (texture2Idx >= 0 && texture2Idx < stageTextures.length) {
                        renderAdditionalTextures[0] = stageTextures[texture2Idx];
                    } else if (texture2Idx == -1){
                        renderAdditionalTextures[0] = stageTextures[stageTextures.length - 1];
                    }
                }
                if (filter.threeInput && filterConfig.parameters?.texture3 !== undefined) {
                    const texture3Idx = Math.floor(filterConfig.parameters.texture3);
                    if (texture3Idx >= 0 && texture3Idx < stageTextures.length) {
                        renderAdditionalTextures[1] = stageTextures[texture3Idx];
                    } else if (texture3Idx == -1){
                        renderAdditionalTextures[1] = stageTextures[stageTextures.length - 1];
                    }
                }
                if (filter.fourInput && filterConfig.parameters?.texture4 !== undefined) {
                    const texture4Idx = Math.floor(filterConfig.parameters.texture4);
                    if (texture4Idx >= 0 && texture4Idx < stageTextures.length) {
                        renderAdditionalTextures[2] = stageTextures[texture4Idx];
                    } else if (texture3Idx == -1){
                        renderAdditionalTextures[2] = stageTextures[stageTextures.length - 1];
                    }
                }
                
                // Bind output framebuffer
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
                
                // Debug: Log filter info before renderPass
                console.log('🔧 FilterEngine: About to call renderPass');
                console.log('  Filter name:', filterConfig.filterName);
                console.log('  Filter object:', filter);
                console.log('  Filter.parameters:', filter.parameters);
                console.log('  Parameters being passed:', filterConfig.parameters);
                
                // Render this filter pass
                this.renderer.renderPass(
                    currentInputTexture,
                    filter.fragmentShader,
                    filterConfig.parameters || {},
                    renderAdditionalTextures,
                    filter  // Pass filter definition for parameter type information
                );
                
                // Store this stage's output for future reference
                if (!isLastFilter) {
                    stageTextures.push(framebuffers[i].texture);
                    currentInputTexture = framebuffers[i].texture;
                }
            }
            
            // Clean up textures and framebuffers
            gl.deleteTexture(sourceTexture);
            additionalWebGLTextures.forEach(tex => gl.deleteTexture(tex));
            framebuffers.forEach(fb => {
                gl.deleteFramebuffer(fb.framebuffer);
                gl.deleteTexture(fb.texture);
            });
            
            // Return base64 result
            return this.toBase64(options.outputFormat, options.outputQuality);
            
        } catch (error) {
            console.error('Error applying filters:', error);
            
            // On error, return source image as base64
            try {
                const sourceImage = await this.loadImage(imageSource);
                this.resizeCanvasToImage(sourceImage, options.maxDimension || 800);
                
                const gl = this.renderer.getContext();
                const sourceTexture = this.renderer.createTexture(sourceImage);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                
                const passthroughShader = `#version 300 es
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
out vec4 fragColor;
void main() {
    vec2 texCoord = gl_FragCoord.xy / u_resolution;
    fragColor = texture(u_image, texCoord);
}`;
                
                this.renderer.renderPass(sourceTexture, passthroughShader, {}, [], null);
                gl.deleteTexture(sourceTexture);
                
                return this.toBase64(options.outputFormat, options.outputQuality);
            } catch (fallbackError) {
                console.error('Error creating fallback image:', fallbackError);
                throw new Error('Failed to process image and unable to create fallback');
            }
        }
    }

    /**
     * Parse hex color with alpha channel (#RRGGBBAA format)
     * Returns normalized [r, g, b, a] array with values 0-1
     * @param {string} hexColor - Hex color string (e.g., '#ffffffff' or '#ffffff')
     * @returns {Array<number>|null} RGBA array or null if invalid
     */
    parseHexColor(hexColor) {
        if (!hexColor || typeof hexColor !== 'string') {
            return null;
        }
        
        // Remove # if present
        const hex = hexColor.replace(/^#/, '');
        
        // Support both 6-digit (#RRGGBB) and 8-digit (#RRGGBBAA) formats
        let r, g, b, a;
        
        if (hex.length === 8) {
            // #RRGGBBAA format
            r = parseInt(hex.substring(0, 2), 16) / 255;
            g = parseInt(hex.substring(2, 4), 16) / 255;
            b = parseInt(hex.substring(4, 6), 16) / 255;
            a = parseInt(hex.substring(6, 8), 16) / 255;
        } else if (hex.length === 6) {
            // #RRGGBB format (assume full opacity)
            r = parseInt(hex.substring(0, 2), 16) / 255;
            g = parseInt(hex.substring(2, 4), 16) / 255;
            b = parseInt(hex.substring(4, 6), 16) / 255;
            a = 1.0;
        } else {
            console.warn('Invalid hex color format:', hexColor);
            return null;
        }
        
        return [r, g, b, a];
    }

    /**
     * Apply a preset to an image with optional parameter overrides
     * Supports both legacy filter-based presets and effect-based presets
     * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} imageSource
     * @param {string} presetName - Name of the preset to apply
     * @param {Object} options - Additional options including:
     *   - additionalTextures: Array of additional texture sources (e.g., masks)
     *   - maxDimension: Maximum canvas dimension
     *   - outputFormat: Output format (default: 'image/png')
     *   - outputQuality: Output quality for lossy formats (0-1)
     *   - backgroundColor: Hex color string with alpha (e.g., '#ffffff00')
     *   - paperColor: Hex color string with alpha (e.g., '#ffffffff')
     *   - Any other filter-specific parameters to override preset defaults
     * @returns {Promise<string>} Base64 data URL
     */
    async applyPreset(imageSource, presetName, options = {}) {
        const preset = this.presets[presetName];
        if (!preset) {
            throw new Error(`Preset "${presetName}" not found`);
        }

        // Create shared execution context for this preset
        const context = new ExecutionContext();
        
        try {
            // Check if this is a new-style preset with steps (includes contourExtraction, effects)
            if (preset.steps) {
                return await this.applyStepsPreset(imageSource, preset, context, options);
            }
            
            // Legacy filter-based preset
            return await this.applyFilterPreset(imageSource, preset, context, options);
            
        } finally {
            // Clean up context after preset execution
            context.clear();
        }
    }

    /**
     * Apply an effect directly without a preset
     * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} imageSource - Image to process
     * @param {string} effectName - Name of the registered effect
     * @param {Object} parameters - Effect parameters
     * @param {Object} options - Additional options
     * @param {Array<HTMLCanvasElement>} options.additionalTextures - Additional textures (e.g., masks)
     * @param {number} options.maxDimension - Maximum canvas dimension
     * @param {string} options.outputFormat - Output format (default: 'image/png')
     * @param {number} options.outputQuality - Output quality for lossy formats (0-1)
     * @returns {Promise<string>} Base64 data URL
     * @example
     * // Apply PaperTearEffect directly
     * const result = await filterEngine.applyEffect(
     *     image,
     *     'PaperTearEffect',
     *     {
     *         noiseIntensity: 1.5,
     *         paperColor: [1, 1, 1, 1]
     *     },
     *     {
     *         additionalTextures: [maskCanvas]
     *     }
     * );
     */
    async applyEffect(imageSource, effectName, parameters = {}, options = {}) {
        const EffectClass = this.effects[effectName];
        if (!EffectClass) {
            throw new Error(`Effect "${effectName}" not registered. Available effects: ${Object.keys(this.effects).join(', ')}`);
        }
        
        // Create execution context for this effect
        const context = new ExecutionContext();
        
        try {
            // Create effect instance
            const effect = new EffectClass(parameters || {});
            effect.filterEngine = this;
            effect.executionContext = context;
            
            console.log(`🎨 Applying effect directly: ${effectName}`);
            
            // Apply effect
            const result = await effect.applyFilters(imageSource, options);
            
            console.log(`✅ Effect "${effectName}" applied successfully`);
            
            return result;
        } finally {
            // Clean up context
            context.clear();
        }
    }

    /** Apply legacy filter-based preset
     * @private
     */
    async applyFilterPreset(imageSource, preset, context, options) {
        // Create a modified filter pipeline with parameter overrides
        const modifiedFilters = [];
        
        for (const filterConfig of preset.filters) {
            const filter = this.filters[filterConfig.filterName];
            if (!filter) {
                modifiedFilters.push(filterConfig);
                continue;
            }

            const parameters = { ...filterConfig.parameters };

            // Override parameters with user-provided options
            if (filter.parameters) {
                for (const [paramName, paramConfig] of Object.entries(filter.parameters)) {
                    // Check if this parameter is provided in options
                    if (options[paramName] !== undefined) {
                        // Handle color parameters
                        if (paramConfig.type === 'color' && typeof options[paramName] === 'string') {
                            const parsedColor = this.parseHexColor(options[paramName]);
                            if (parsedColor) {
                                parameters[paramName] = parsedColor;
                            } else {
                                console.warn(`Invalid color format for ${paramName}:`, options[paramName]);
                            }
                        } else {
                            // For other parameter types, use the value directly
                            parameters[paramName] = options[paramName];
                        }
                    }
                }
            }
            
            // Load texture parameters that are filenames
            if (filter.parameters) {
                for (const [paramName, paramConfig] of Object.entries(filter.parameters)) {
                    if (paramConfig.type === 'texture' && typeof parameters[paramName] === 'string') {
                        // Load the texture from filename
                        try {
                            parameters[paramName] = await this.loadLutTexture(parameters[paramName]);
                        } catch (error) {
                            console.error(`Failed to load texture "${parameters[paramName]}" for parameter "${paramName}":`, error);
                            parameters[paramName] = null;
                        }
                    }
                }
            }

            modifiedFilters.push({
                filterName: filterConfig.filterName,
                parameters
            });
        }
        
        return this.applyFilters(imageSource, modifiedFilters, options);
    }

    /**
     * Get the canvas element
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Get the WebGL renderer
     * @returns {WebGLRenderer}
     */
    getRenderer() {
        return this.renderer;
    }
}
