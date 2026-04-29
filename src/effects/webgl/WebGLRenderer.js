/**
 * WebGLRenderer - Low-level WebGL operations class
 * Handles all WebGL context management, shader compilation, texture creation, and rendering
 * Zero UI dependencies - pure WebGL operations only
 */
export default class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
        
        if (!this.initWebGL()) {
            throw new Error('WebGL 2 not supported in your browser');
        }
    }

    /**
     * Initialize WebGL context
     * @returns {boolean} Success status
     */
    initWebGL() {
        this.gl = this.canvas.getContext('webgl2', {
            alpha: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: true
        });
        return this.gl !== null;
    }

    /**
     * Get the WebGL context
     * @returns {WebGL2RenderingContext}
     */
    getContext() {
        return this.gl;
    }

    /**
     * Create a shader
     * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
     * @param {string} source - Shader source code
     * @returns {WebGLShader|null}
     */
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    /**
     * Create a shader program
     * @param {WebGLShader} vertexShader
     * @param {WebGLShader} fragmentShader
     * @returns {WebGLProgram|null}
     */
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }

    /**
     * Setup vertex buffer for full-screen quad
     * @param {WebGLProgram} program
     */
    setupVertexBuffer(program) {
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);
        
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        
        const positionLocation = this.gl.getAttribLocation(program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    /**
     * Create a texture from an image source
     * @param {HTMLImageElement|HTMLCanvasElement} imageSource
     * @returns {WebGLTexture}
     */
    createTexture(imageSource) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Flip the image data vertically during unpacking
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageSource);
        
        return texture;
    }

    /**
     * Create a framebuffer with attached texture
     * @param {number} width - Framebuffer width
     * @param {number} height - Framebuffer height
     * @returns {{framebuffer: WebGLFramebuffer, texture: WebGLTexture}}
     */
    createFramebuffer(width, height) {
        const framebuffer = this.gl.createFramebuffer();
        const texture = this.gl.createTexture();
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Flip the image data vertically during unpacking
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
        
        return { framebuffer, texture };
    }

    /**
     * Render a single pass with given shader and uniforms
     * @param {WebGLTexture} inputTexture - Primary input texture
     * @param {string} fragmentShaderSource - Fragment shader source code
     * @param {Object} uniforms - Uniform values to set
     * @param {Array<WebGLTexture>} additionalTextures - Additional textures for multi-input filters
     * @param {Object} filterDefinition - Filter definition with parameter metadata
     */
    renderPass(inputTexture, fragmentShaderSource, uniforms = {}, additionalTextures = [], filterDefinition = null) {
        // Create shaders and program
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        const program = this.createProgram(vertexShader, fragmentShader);
        
        if (!program) {
            console.error('Failed to create shader program');
            return;
        }
        
        this.gl.useProgram(program);
        this.setupVertexBuffer(program);
        
        // Set primary texture (u_image, texture unit 0)
        const imageLocation = this.gl.getUniformLocation(program, 'u_image');
        this.gl.uniform1i(imageLocation, 0);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);

        // Set resolution uniform
        const resolutionLocation = this.gl.getUniformLocation(program, 'u_resolution');
        this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);
        
        // Bind additional textures for multi-input filters
        if (additionalTextures && additionalTextures.length > 0) {
            const textureNames = ['u_texture2', 'u_texture3', 'u_texture4'];
            
            for (let i = 0; i < Math.min(additionalTextures.length, 3); i++) {
                if (additionalTextures[i]) {
                    const textureLocation = this.gl.getUniformLocation(program, textureNames[i]);
                    if (textureLocation) {
                        this.gl.uniform1i(textureLocation, i + 1);
                        this.gl.activeTexture(this.gl.TEXTURE1 + i);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, additionalTextures[i]);
                    }
                }
            }
        }
        
        // Set custom uniforms with type detection
        for (const [name, value] of Object.entries(uniforms)) {
            // Skip texture selector parameters
            if (name === 'texture2' || name === 'texture3' || name === 'texture4' || name === 'sourceIdx') {
                continue;
            }
            
            const location = this.gl.getUniformLocation(program, name);
            if (!location) continue;
            
            // Determine parameter type from filter definition or value type
            let paramType = 'float'; // default
            if (filterDefinition && filterDefinition.parameters && filterDefinition.parameters[name]) {
                paramType = filterDefinition.parameters[name].type || 'float';
            } else if (Array.isArray(value) && value.length === 4) {
                paramType = 'color';
            }
            
            // Set uniform based on type
            if (paramType === 'color' && Array.isArray(value) && value.length === 4) {
                // vec4 color: [r, g, b, a]
                this.gl.uniform4f(location, value[0], value[1], value[2], value[3]);
            } else if (typeof value === 'number') {
                // float value
                this.gl.uniform1f(location, value);
            }
        }
        
        // Bind asset textures (starting from texture unit 4)
        if (filterDefinition && filterDefinition.parameters) {
            let assetTextureUnit = 4;
            console.log('🔍 Debug: Checking for texture parameters');
            console.log('filterDefinition.parameters:', filterDefinition.parameters);
            console.log('uniforms:', uniforms);
            
            for (const [name, paramDef] of Object.entries(filterDefinition.parameters)) {
                console.log(`Checking param: ${name}, type: ${paramDef.type}`);
                
                if (paramDef.type === 'texture') {
                    console.log(`  ${name} value:`, uniforms[name]);
                    console.log(`  Is WebGLTexture:`, uniforms[name] instanceof WebGLTexture);
                    
                    if (uniforms[name] && uniforms[name] instanceof WebGLTexture) {
                        const textureLocation = this.gl.getUniformLocation(program, name);
                        console.log(`  Uniform location for ${name}:`, textureLocation);
                        
                        if (textureLocation) {
                            console.log(`  ✅ Binding ${name} to texture unit ${assetTextureUnit}`);
                            this.gl.uniform1i(textureLocation, assetTextureUnit);
                            this.gl.activeTexture(this.gl.TEXTURE0 + assetTextureUnit);
                            this.gl.bindTexture(this.gl.TEXTURE_2D, uniforms[name]);
                            assetTextureUnit++;
                        } else {
                            console.warn(`  ⚠️ Could not find uniform location for ${name}`);
                        }
                    }
                }
            }
        } else {
            console.log('⚠️ No filterDefinition or parameters found');
        }

        // Flip the image data vertically during unpacking
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        // Draw full-screen quad
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
        // Cleanup
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);
        this.gl.deleteProgram(program);
    }

    /**
     * Resize the canvas
     * @param {number} width
     * @param {number} height
     */
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    /**
     * Clean up WebGL resources
     */
    cleanup() {
        // Context cleanup is handled by browser
        // Individual textures and framebuffers should be deleted by user
    }
}
