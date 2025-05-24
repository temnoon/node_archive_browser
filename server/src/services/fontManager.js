const fontkit = require('fontkit');
const opentype = require('opentype.js');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const { EventEmitter } = require('events');

/**
 * Comprehensive Font Management System
 * Handles system fonts, web fonts, custom fonts, and advanced typography
 */
class FontManager extends EventEmitter {
  constructor() {
    super();
    this.fonts = new Map();
    this.webFontCache = new Map();
    this.customFonts = new Map();
    this.fontMetrics = new Map();
    this.openTypeFeatures = new Map();
    this.fontStorage = path.join(__dirname, '../../fonts');
    this.webFontStorage = path.join(__dirname, '../../fonts/web');
    this.customFontStorage = path.join(__dirname, '../../fonts/custom');
    this.googleFontsApiKey = process.env.GOOGLE_FONTS_API_KEY;
    this.init();
  }

  async init() {
    await this.ensureDirectories();
    await this.loadSystemFonts();
    await this.loadCachedWebFonts();
    await this.loadCustomFonts();
    console.log('Font Manager initialized');
  }

  async ensureDirectories() {
    await fs.ensureDir(this.fontStorage);
    await fs.ensureDir(this.webFontStorage);
    await fs.ensureDir(this.customFontStorage);
  }

  /**
   * System Font Discovery and Loading
   */
  
  async loadSystemFonts() {
    const systemFonts = this.getSystemFontPaths();
    let loadedCount = 0;

    for (const fontPath of systemFonts) {
      try {
        const fontData = await this.loadFontFile(fontPath);
        if (fontData) {
          this.fonts.set(fontData.familyName, {
            ...fontData,
            type: 'system',
            path: fontPath,
            loaded: true
          });
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Failed to load system font ${fontPath}:`, error.message);
      }
    }

    // Add built-in PDF fonts
    const builtInFonts = [
      { family: 'Helvetica', variants: ['regular', 'bold', 'italic', 'bold-italic'] },
      { family: 'Times-Roman', variants: ['regular', 'bold', 'italic', 'bold-italic'] },
      { family: 'Courier', variants: ['regular', 'bold', 'italic', 'bold-italic'] },
      { family: 'Symbol', variants: ['regular'] },
      { family: 'ZapfDingbats', variants: ['regular'] }
    ];

    builtInFonts.forEach(font => {
      this.fonts.set(font.family, {
        familyName: font.family,
        type: 'builtin',
        variants: font.variants,
        loaded: true,
        metrics: this.getBuiltInFontMetrics(font.family)
      });
      loadedCount++;
    });

    console.log(`Loaded ${loadedCount} system and built-in fonts`);
    this.emit('system-fonts-loaded', { count: loadedCount });
  }

  getSystemFontPaths() {
    const platform = process.platform;
    const fontPaths = [];

    switch (platform) {
      case 'darwin': // macOS
        fontPaths.push('/System/Library/Fonts');
        fontPaths.push('/Library/Fonts');
        fontPaths.push(path.join(process.env.HOME, 'Library/Fonts'));
        break;
      
      case 'win32': // Windows
        fontPaths.push(path.join(process.env.WINDIR, 'Fonts'));
        break;
      
      case 'linux':
        fontPaths.push('/usr/share/fonts');
        fontPaths.push('/usr/local/share/fonts');
        fontPaths.push(path.join(process.env.HOME, '.fonts'));
        fontPaths.push('/usr/share/fonts/truetype');
        break;
    }

    // Scan for font files
    const fontFiles = [];
    for (const basePath of fontPaths) {
      if (fs.existsSync(basePath)) {
        const files = this.scanFontDirectory(basePath);
        fontFiles.push(...files);
      }
    }

    return fontFiles;
  }

  scanFontDirectory(dirPath) {
    const fontFiles = [];
    const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          fontFiles.push(...this.scanFontDirectory(fullPath));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (fontExtensions.includes(ext)) {
            fontFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning font directory ${dirPath}:`, error.message);
    }

    return fontFiles;
  }

  async loadFontFile(fontPath) {
    try {
      const fontBuffer = await fs.readFile(fontPath);
      const font = fontkit.open(fontBuffer);
      
      return {
        familyName: font.familyName,
        postscriptName: font.postscriptName,
        fullName: font.fullName,
        subfamily: font.subfamilyName,
        weight: this.mapFontWeight(font.weight),
        style: this.mapFontStyle(font),
        stretch: font.stretch,
        version: font.version,
        metrics: {
          unitsPerEm: font.unitsPerEm,
          ascent: font.ascent,
          descent: font.descent,
          lineGap: font.lineGap,
          capHeight: font.capHeight,
          xHeight: font.xHeight,
          bbox: font.bbox
        },
        features: this.extractOpenTypeFeatures(font),
        buffer: fontBuffer,
        size: fontBuffer.length
      };
    } catch (error) {
      console.warn(`Error loading font file ${fontPath}:`, error.message);
      return null;
    }
  }

  /**
   * Web Font Integration
   */

  async loadWebFont(fontFamily, variants = ['regular'], provider = 'google') {
    const cacheKey = `${provider}:${fontFamily}:${variants.join(',')}`;
    
    if (this.webFontCache.has(cacheKey)) {
      return this.webFontCache.get(cacheKey);
    }

    try {
      let fontData;
      
      switch (provider) {
        case 'google':
          fontData = await this.loadGoogleFont(fontFamily, variants);
          break;
        case 'adobe':
          fontData = await this.loadAdobeFont(fontFamily, variants);
          break;
        default:
          throw new Error(`Unsupported font provider: ${provider}`);
      }

      this.webFontCache.set(cacheKey, fontData);
      this.fonts.set(fontFamily, fontData);
      
      // Cache to disk
      const cacheFile = path.join(this.webFontStorage, `${cacheKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
      await fs.writeJSON(cacheFile, fontData);
      
      this.emit('web-font-loaded', { fontFamily, provider, variants });
      return fontData;
    } catch (error) {
      console.error(`Failed to load web font ${fontFamily}:`, error.message);
      throw error;
    }
  }

  async loadGoogleFont(fontFamily, variants) {
    const googleFontsApiUrl = 'https://www.googleapis.com/webfonts/v1/webfonts';
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@${variants.join(';')}`;
    
    try {
      // Get font information from Google Fonts API
      const apiUrl = this.googleFontsApiKey 
        ? `${googleFontsApiUrl}?key=${this.googleFontsApiKey}&family=${encodeURIComponent(fontFamily)}`
        : null;
      
      let fontInfo = null;
      if (apiUrl) {
        const response = await this.httpGet(apiUrl);
        const data = JSON.parse(response);
        fontInfo = data.items?.find(item => item.family === fontFamily);
      }

      // Get CSS with font URLs
      const cssResponse = await this.httpGet(cssUrl);
      const fontUrls = this.extractFontUrlsFromCSS(cssResponse);
      
      const fontData = {
        familyName: fontFamily,
        type: 'web',
        provider: 'google',
        variants: variants,
        cssUrl: cssUrl,
        urls: fontUrls,
        loaded: true,
        info: fontInfo,
        loadedAt: new Date().toISOString()
      };

      // Download and cache font files
      const files = {};
      for (const [variant, url] of Object.entries(fontUrls)) {
        try {
          const fontBuffer = await this.downloadFont(url);
          const fileName = `${fontFamily.replace(/\s+/g, '_')}_${variant}.woff2`;
          const filePath = path.join(this.webFontStorage, fileName);
          await fs.writeFile(filePath, fontBuffer);
          files[variant] = { buffer: fontBuffer, path: filePath };
        } catch (error) {
          console.warn(`Failed to download font variant ${variant}:`, error.message);
        }
      }
      
      fontData.files = files;
      return fontData;
    } catch (error) {
      throw new Error(`Failed to load Google Font ${fontFamily}: ${error.message}`);
    }
  }

  async loadAdobeFont(fontFamily, variants) {
    // Adobe Fonts (TypeKit) integration would go here
    // This is a placeholder for future implementation
    throw new Error('Adobe Fonts integration not yet implemented');
  }

  extractFontUrlsFromCSS(css) {
    const urls = {};
    const urlRegex = /url\(([^)]+)\)/g;
    const fontFaceRegex = /@font-face\s*{[^}]+}/g;
    
    const fontFaces = css.match(fontFaceRegex) || [];
    
    fontFaces.forEach(fontFace => {
      const urlMatch = fontFace.match(urlRegex);
      const weightMatch = fontFace.match(/font-weight:\s*(\d+)/);
      const styleMatch = fontFace.match(/font-style:\s*(\w+)/);
      
      if (urlMatch) {
        const url = urlMatch[0].replace(/url\(["']?([^"')]+)["']?\)/, '$1');
        const weight = weightMatch ? weightMatch[1] : '400';
        const style = styleMatch ? styleMatch[1] : 'normal';
        
        let variant = 'regular';
        if (weight !== '400' || style !== 'normal') {
          variant = weight === '700' ? 'bold' : weight;
          if (style === 'italic') {
            variant += variant === 'regular' ? 'italic' : '-italic';
          }
        }
        
        urls[variant] = url;
      }
    });
    
    return urls;
  }

  async downloadFont(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Custom Font Management
   */

  async embedCustomFont(fontBuffer, fontName, metadata = {}) {
    try {
      const font = fontkit.open(fontBuffer);
      const fontData = {
        familyName: fontName || font.familyName,
        originalName: font.familyName,
        type: 'custom',
        postscriptName: font.postscriptName,
        fullName: font.fullName,
        weight: this.mapFontWeight(font.weight),
        style: this.mapFontStyle(font),
        metrics: {
          unitsPerEm: font.unitsPerEm,
          ascent: font.ascent,
          descent: font.descent,
          lineGap: font.lineGap,
          capHeight: font.capHeight,
          xHeight: font.xHeight,
          bbox: font.bbox
        },
        features: this.extractOpenTypeFeatures(font),
        buffer: fontBuffer,
        size: fontBuffer.length,
        metadata: metadata,
        uploadedAt: new Date().toISOString(),
        loaded: true
      };

      // Save font file
      const fileName = `${fontData.familyName.replace(/\s+/g, '_')}.ttf`;
      const filePath = path.join(this.customFontStorage, fileName);
      await fs.writeFile(filePath, fontBuffer);
      fontData.path = filePath;

      // Store font data
      this.customFonts.set(fontData.familyName, fontData);
      this.fonts.set(fontData.familyName, fontData);

      // Save metadata
      const metadataFile = path.join(this.customFontStorage, `${fileName}.json`);
      await fs.writeJSON(metadataFile, {
        familyName: fontData.familyName,
        originalName: fontData.originalName,
        metadata: fontData.metadata,
        uploadedAt: fontData.uploadedAt,
        size: fontData.size
      });

      this.emit('custom-font-embedded', { fontName: fontData.familyName, fontData });
      return fontData;
    } catch (error) {
      throw new Error(`Failed to embed custom font: ${error.message}`);
    }
  }

  async loadCustomFonts() {
    try {
      const files = await fs.readdir(this.customFontStorage);
      const fontFiles = files.filter(file => file.endsWith('.ttf') || file.endsWith('.otf'));
      let loadedCount = 0;

      for (const fontFile of fontFiles) {
        try {
          const fontPath = path.join(this.customFontStorage, fontFile);
          const fontBuffer = await fs.readFile(fontPath);
          const metadataPath = `${fontPath}.json`;
          
          let metadata = {};
          if (await fs.pathExists(metadataPath)) {
            metadata = await fs.readJSON(metadataPath);
          }

          const font = fontkit.open(fontBuffer);
          const fontData = {
            familyName: metadata.familyName || font.familyName,
            originalName: font.familyName,
            type: 'custom',
            path: fontPath,
            buffer: fontBuffer,
            metadata: metadata.metadata || {},
            uploadedAt: metadata.uploadedAt,
            loaded: true
          };

          this.customFonts.set(fontData.familyName, fontData);
          this.fonts.set(fontData.familyName, fontData);
          loadedCount++;
        } catch (error) {
          console.warn(`Failed to load custom font ${fontFile}:`, error.message);
        }
      }

      console.log(`Loaded ${loadedCount} custom fonts`);
    } catch (error) {
      console.warn('Error loading custom fonts:', error.message);
    }
  }

  async removeCustomFont(fontName) {
    const fontData = this.customFonts.get(fontName);
    if (!fontData) {
      throw new Error(`Custom font ${fontName} not found`);
    }

    // Remove files
    if (fontData.path && await fs.pathExists(fontData.path)) {
      await fs.remove(fontData.path);
      await fs.remove(`${fontData.path}.json`);
    }

    // Remove from caches
    this.customFonts.delete(fontName);
    this.fonts.delete(fontName);

    this.emit('custom-font-removed', { fontName });
  }

  /**
   * Typography and Metrics
   */

  calculateTextMetrics(text, fontFamily, fontSize, options = {}) {
    const fontData = this.fonts.get(fontFamily);
    if (!fontData || !fontData.metrics) {
      return this.getDefaultTextMetrics(text, fontSize);
    }

    const scale = fontSize / fontData.metrics.unitsPerEm;
    const lineHeight = options.lineHeight || 1.2;
    
    // Estimate text width (simplified calculation)
    let textWidth = 0;
    for (let i = 0; i < text.length; i++) {
      textWidth += this.getCharacterWidth(text.charCodeAt(i), fontData) * scale;
    }

    return {
      width: textWidth,
      height: fontSize * lineHeight,
      ascent: fontData.metrics.ascent * scale,
      descent: Math.abs(fontData.metrics.descent) * scale,
      lineGap: fontData.metrics.lineGap * scale,
      fontSize: fontSize,
      lineHeight: fontSize * lineHeight,
      fontFamily: fontFamily
    };
  }

  getCharacterWidth(charCode, fontData) {
    // Simplified character width estimation
    // In a real implementation, this would use actual glyph metrics
    if (charCode >= 32 && charCode <= 126) { // Printable ASCII
      return fontData.metrics.unitsPerEm * 0.5; // Rough estimate
    }
    return fontData.metrics.unitsPerEm * 0.3; // Narrower for other characters
  }

  getDefaultTextMetrics(text, fontSize) {
    // Fallback metrics for unknown fonts
    const averageCharWidth = fontSize * 0.6;
    return {
      width: text.length * averageCharWidth,
      height: fontSize * 1.2,
      ascent: fontSize * 0.8,
      descent: fontSize * 0.2,
      lineGap: fontSize * 0.2,
      fontSize: fontSize,
      lineHeight: fontSize * 1.2,
      fontFamily: 'Helvetica'
    };
  }

  /**
   * OpenType Features
   */

  extractOpenTypeFeatures(font) {
    const features = {};
    
    if (font.GSUB) {
      const gsub = font.GSUB;
      if (gsub.featureList) {
        gsub.featureList.forEach((feature, index) => {
          if (feature.tag) {
            features[feature.tag] = {
              name: this.getFeatureName(feature.tag),
              description: this.getFeatureDescription(feature.tag),
              enabled: false
            };
          }
        });
      }
    }

    return features;
  }

  getFeatureName(tag) {
    const featureNames = {
      'liga': 'Standard Ligatures',
      'dlig': 'Discretionary Ligatures',
      'kern': 'Kerning',
      'calt': 'Contextual Alternates',
      'swsh': 'Swash',
      'smcp': 'Small Capitals',
      'c2sc': 'Small Capitals From Capitals',
      'onum': 'Old Style Numbers',
      'lnum': 'Lining Numbers',
      'tnum': 'Tabular Numbers',
      'pnum': 'Proportional Numbers',
      'frac': 'Fractions',
      'sups': 'Superscript',
      'subs': 'Subscript',
      'zero': 'Slashed Zero',
      'ss01': 'Stylistic Set 1',
      'ss02': 'Stylistic Set 2',
      'ss03': 'Stylistic Set 3',
      'salt': 'Stylistic Alternates'
    };
    
    return featureNames[tag] || tag.toUpperCase();
  }

  getFeatureDescription(tag) {
    const descriptions = {
      'liga': 'Replaces letter combinations with ligatures',
      'dlig': 'Activates special decorative ligatures',
      'kern': 'Adjusts spacing between specific letter pairs',
      'calt': 'Applies contextual letter substitutions',
      'swsh': 'Enables decorative swash characters',
      'smcp': 'Converts lowercase to small capitals',
      'onum': 'Uses old-style (lowercase) numbers',
      'lnum': 'Uses lining (uppercase) numbers',
      'tnum': 'Uses tabular (monospaced) numbers',
      'frac': 'Automatically creates fractions',
      'sups': 'Creates superscript characters',
      'subs': 'Creates subscript characters',
      'zero': 'Uses slashed zero for clarity'
    };
    
    return descriptions[tag] || 'OpenType feature';
  }

  applyOpenTypeFeatures(text, fontFamily, features = {}) {
    const fontData = this.fonts.get(fontFamily);
    if (!fontData || !fontData.features) {
      return text;
    }

    // This is a simplified implementation
    // Real OpenType feature application would require a full shaping engine
    let processedText = text;

    if (features.liga && fontData.features.liga) {
      processedText = this.applyLigatures(processedText);
    }

    if (features.smcp && fontData.features.smcp) {
      processedText = processedText.toLowerCase();
    }

    return processedText;
  }

  applyLigatures(text) {
    // Simplified ligature replacement
    const ligatures = {
      'fi': 'ﬁ',
      'fl': 'ﬂ',
      'ff': 'ﬀ',
      'ffi': 'ﬃ',
      'ffl': 'ﬄ'
    };

    let result = text;
    Object.entries(ligatures).forEach(([search, replace]) => {
      result = result.replace(new RegExp(search, 'g'), replace);
    });

    return result;
  }

  /**
   * Font Discovery and Search
   */

  searchFonts(query, options = {}) {
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [familyName, fontData] of this.fonts) {
      if (familyName.toLowerCase().includes(searchTerm)) {
        const score = this.calculateSearchScore(familyName, searchTerm);
        results.push({
          ...fontData,
          searchScore: score
        });
      }
    }

    // Sort by search score
    results.sort((a, b) => b.searchScore - a.searchScore);

    // Apply filters
    if (options.type) {
      return results.filter(font => font.type === options.type);
    }

    if (options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  calculateSearchScore(fontName, searchTerm) {
    const name = fontName.toLowerCase();
    const term = searchTerm.toLowerCase();
    
    if (name === term) return 100;
    if (name.startsWith(term)) return 80;
    if (name.includes(term)) return 60;
    
    // Calculate fuzzy match score
    let score = 0;
    for (let i = 0; i < term.length; i++) {
      if (name.includes(term[i])) score += 1;
    }
    
    return (score / term.length) * 40;
  }

  getFontsByCategory(category) {
    const categories = {
      serif: ['Times', 'Georgia', 'serif'],
      sans: ['Helvetica', 'Arial', 'sans'],
      mono: ['Courier', 'Monaco', 'monospace'],
      display: ['Impact', 'Bebas', 'display'],
      script: ['Brush', 'Script', 'cursive']
    };

    const keywords = categories[category] || [];
    const results = [];

    for (const [familyName, fontData] of this.fonts) {
      const name = familyName.toLowerCase();
      if (keywords.some(keyword => name.includes(keyword.toLowerCase()))) {
        results.push(fontData);
      }
    }

    return results;
  }

  /**
   * Utility Methods
   */

  mapFontWeight(weight) {
    if (typeof weight === 'number') {
      if (weight <= 100) return 'thin';
      if (weight <= 200) return 'extra-light';
      if (weight <= 300) return 'light';
      if (weight <= 400) return 'regular';
      if (weight <= 500) return 'medium';
      if (weight <= 600) return 'semi-bold';
      if (weight <= 700) return 'bold';
      if (weight <= 800) return 'extra-bold';
      return 'black';
    }
    return 'regular';
  }

  mapFontStyle(font) {
    if (font.isItalic) return 'italic';
    if (font.isOblique) return 'oblique';
    return 'normal';
  }

  getBuiltInFontMetrics(fontFamily) {
    const metrics = {
      'Helvetica': { unitsPerEm: 1000, ascent: 718, descent: -207, lineGap: 0 },
      'Times-Roman': { unitsPerEm: 1000, ascent: 683, descent: -217, lineGap: 0 },
      'Courier': { unitsPerEm: 1000, ascent: 629, descent: -157, lineGap: 0 }
    };
    
    return metrics[fontFamily] || metrics['Helvetica'];
  }

  async httpGet(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  async loadCachedWebFonts() {
    try {
      const cacheFiles = await fs.readdir(this.webFontStorage);
      const jsonFiles = cacheFiles.filter(file => file.endsWith('.json'));
      let loadedCount = 0;

      for (const jsonFile of jsonFiles) {
        try {
          const cachePath = path.join(this.webFontStorage, jsonFile);
          const fontData = await fs.readJSON(cachePath);
          
          this.webFontCache.set(jsonFile.replace('.json', ''), fontData);
          this.fonts.set(fontData.familyName, fontData);
          loadedCount++;
        } catch (error) {
          console.warn(`Failed to load cached web font ${jsonFile}:`, error.message);
        }
      }

      if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} cached web fonts`);
      }
    } catch (error) {
      console.warn('Error loading cached web fonts:', error.message);
    }
  }

  /**
   * Public API Methods
   */

  getAvailableFonts() {
    return Array.from(this.fonts.values());
  }

  getFontData(fontFamily) {
    return this.fonts.get(fontFamily);
  }

  isFontLoaded(fontFamily) {
    const fontData = this.fonts.get(fontFamily);
    return fontData && fontData.loaded;
  }

  async preloadFont(fontFamily, variants = ['regular']) {
    if (this.isFontLoaded(fontFamily)) {
      return this.getFontData(fontFamily);
    }

    // Try to load as web font first
    try {
      return await this.loadWebFont(fontFamily, variants);
    } catch (error) {
      console.warn(`Could not load web font ${fontFamily}:`, error.message);
      return null;
    }
  }

  getSystemFonts() {
    return Array.from(this.fonts.values()).filter(font => font.type === 'system' || font.type === 'builtin');
  }

  getWebFonts() {
    return Array.from(this.fonts.values()).filter(font => font.type === 'web');
  }

  getCustomFonts() {
    return Array.from(this.fonts.values()).filter(font => font.type === 'custom');
  }

  getFontFamilies() {
    return Array.from(this.fonts.keys());
  }

  async clearCache() {
    this.webFontCache.clear();
    await fs.emptyDir(this.webFontStorage);
    this.emit('cache-cleared');
  }

  getStats() {
    const fonts = Array.from(this.fonts.values());
    return {
      total: fonts.length,
      system: fonts.filter(f => f.type === 'system' || f.type === 'builtin').length,
      web: fonts.filter(f => f.type === 'web').length,
      custom: fonts.filter(f => f.type === 'custom').length,
      cacheSize: this.webFontCache.size
    };
  }
}

module.exports = FontManager;