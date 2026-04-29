/**
 * ExecutionContext - Shared state during preset execution
 * Stores extracted contours, intermediate textures, and metadata
 * Enables caching and reuse of CPU-side data across multiple effects
 */
export default class ExecutionContext {
    constructor() {
        // CPU-side contour data (points, SVG paths, bezier curves)
        // Key: contourId (string), Value: contour data object
        this.contours = new Map();
        
        // GPU-side texture references
        this.textures = [];
        
        // Additional metadata for effects
        this.metadata = {};
    }
    
    /**
     * Store contour data with a unique identifier
     * @param {string} key - Contour identifier (e.g., 'mask0', 'person_contour')
     * @param {Object} contourData - Extracted contour data from ContourExtractor
     * @param {Array<Array<{x, y}>>} contourData.contours - Array of point lists
     * @param {Array} contourData.bezierCurves - Bezier curve representation
     * @param {Array<string>} contourData.svgPaths - SVG path strings
     * @param {Object} contourData.bounds - Bounding box
     */
    setContour(key, contourData) {
        if (!key || typeof key !== 'string') {
            throw new Error('Contour key must be a non-empty string');
        }
        
        if (!contourData) {
            throw new Error('Contour data cannot be null or undefined');
        }
        
        this.contours.set(key, contourData);
        console.log(`📦 Contour cached: "${key}" (${contourData.contours[0]?.length || 0} points)`);
    }
    
    /**
     * Retrieve contour data by identifier
     * @param {string} key - Contour identifier
     * @returns {Object|null} Contour data or null if not found
     */
    getContour(key) {
        const contourData = this.contours.get(key);
        
        if (!contourData) {
            console.warn(`⚠️ Contour not found: "${key}"`);
            return null;
        }
        
        return contourData;
    }
    
    /**
     * Check if contour exists in cache
     * @param {string} key - Contour identifier
     * @returns {boolean}
     */
    hasContour(key) {
        return this.contours.has(key);
    }
    
    /**
     * Store texture reference
     * @param {WebGLTexture} texture
     * @returns {number} Index of stored texture
     */
    addTexture(texture) {
        this.textures.push(texture);
        return this.textures.length - 1;
    }
    
    /**
     * Get texture by index
     * @param {number} index
     * @returns {WebGLTexture|null}
     */
    getTexture(index) {
        return this.textures[index] || null;
    }
    
    /**
     * Store arbitrary metadata
     * @param {string} key
     * @param {*} value
     */
    setMetadata(key, value) {
        this.metadata[key] = value;
    }
    
    /**
     * Get metadata by key
     * @param {string} key
     * @returns {*}
     */
    getMetadata(key) {
        return this.metadata[key];
    }
    
    /**
     * Clear all cached data
     * Should be called after preset execution completes
     */
    clear() {
        this.contours.clear();
        this.textures = [];
        this.metadata = {};
        console.log('🧹 ExecutionContext cleared');
    }
    
    /**
     * Get summary of cached data
     * @returns {Object}
     */
    getSummary() {
        return {
            contourCount: this.contours.size,
            contourKeys: Array.from(this.contours.keys()),
            textureCount: this.textures.length,
            metadataKeys: Object.keys(this.metadata)
        };
    }
}
