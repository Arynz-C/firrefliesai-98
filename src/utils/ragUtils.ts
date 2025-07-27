// RAG utilities for search and calculator tools
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Optimized search function using Edge Function
export async function searchDuckDuckGo(query: string): Promise<string[]> {
  try {
    console.log('🔍 Starting optimized search for:', query);
    
    // Import supabase client dynamically to avoid build issues
    const { supabase } = await import('@/integrations/supabase/client');
    
    try {
      // Use Edge Function for reliable search
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'search',
          query: query
        }
      });
      
      if (error) {
        console.error('❌ Search error via Edge Function:', error);
        return [];
      }
      
      if (!data || !Array.isArray(data.urls)) {
        console.warn('No URLs received from search');
        return [];
      }
      
      console.log(`🔗 Found ${data.urls.length} URLs:`, data.urls);
      return data.urls;
      
    } catch (error) {
      console.error('❌ Search error:', error);
      return [];
    }
  } catch (error) {
    console.error('❌ Search error:', error);
    return [];
  }
}

// Helper function to validate URLs
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Optimized parallel content fetching using Edge Function
export async function getWebpageContent(url: string): Promise<string | null> {
  try {
    console.log(`🌐 Fetching optimized content from: ${url}`);
    
    // Import supabase client dynamically to avoid build issues
    const { supabase } = await import('@/integrations/supabase/client');
    
    try {
      // Use Edge Function for reliable web scraping
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'web',
          url: url
        }
      });
      
      if (error) {
        console.error(`❌ Edge Function error for ${url}:`, error);
        return null;
      }
      
      if (!data || !data.content || data.content.length < 100) {
        console.warn('Insufficient content received from Edge Function');
        return null;
      }
      
      console.log(`✅ Fetched ${data.content.length} characters via Edge Function`);
      return data.content;
      
    } catch (error) {
      console.error(`❌ Content fetch failed for ${url}:`, error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to get content from ${url}:`, error);
    return null;
  }
}

// Optimized content extraction
async function extractOptimizedContent(html: string): Promise<string | null> {
  try {
    // Parse HTML efficiently
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove unwanted elements in batch
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 'aside',
      '.sidebar', '.menu', '.advertisement', '.ads', '.cookie-notice',
      '.social-share', '.comments', '.related-posts', '.newsletter'
    ];
    
    unwantedSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    let content = '';
    
    // Priority content selectors (most specific first)
    const contentSelectors = [
      'article[role="main"]',
      'main article',
      '[role="main"]',
      'article',
      '.article-content',
      '.post-content',
      '.entry-content',
      'main .content',
      'main',
      '#content',
      '.page-content'
    ];
    
    // Find best content container
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const textContent = element.textContent || '';
        if (textContent.length > 200) {
          content = textContent;
          console.log(`📄 Content found with: ${selector}`);
          break;
        }
      }
    }
    
    // Fallback: collect paragraph content
    if (!content || content.length < 200) {
      const paragraphs = Array.from(doc.querySelectorAll('p'))
        .map(p => p.textContent?.trim())
        .filter(text => text && text.length > 30)
        .slice(0, 10); // Limit to first 10 paragraphs
      
      content = paragraphs.join('\n\n');
      console.log(`📄 Extracted ${paragraphs.length} paragraphs`);
    }
    
    if (!content || content.length < 50) {
      return null;
    }
    
    // Optimized content cleaning
    content = content
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n')  // Normalize newlines
      .trim();
    
    // Filter out noise - optimized regex
    const noisePatterns = [
      /\b(cookie|privacy|terms|subscribe|newsletter|advertisement)\b/gi,
      /\b(copyright|all rights reserved|©)\b/gi,
      /\b(click here|read more|continue reading)\b/gi
    ];
    
    const sentences = content.split(/[.!?]+/)
      .filter(sentence => {
        const clean = sentence.trim();
        return clean.length > 15 && 
               !noisePatterns.some(pattern => pattern.test(clean));
      })
      .slice(0, 12); // Limit sentences
    
    const finalContent = sentences.join('. ').substring(0, 3000);
    console.log(`📊 Optimized content: ${finalContent.length} chars`);
    
    return finalContent || null;
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return null;
  }
}

// Parallel search and content fetching - now using Edge Function's integrated approach
export async function searchAndFetchContent(query: string): Promise<{url: string, content: string}[]> {
  try {
    console.log('🚀 Starting integrated search and fetch for:', query);
    
    // Import supabase client dynamically to avoid build issues
    const { supabase } = await import('@/integrations/supabase/client');
    
    try {
      // Use Edge Function for integrated search and content fetching
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'search',
          query: query
        }
      });
      
      if (error) {
        console.error('❌ Search error via Edge Function:', error);
        return [];
      }
      
      if (!data) {
        console.warn('No data received from search');
        return [];
      }
      
      // Extract content from urlsWithContent if available
      const results: {url: string, content: string}[] = [];
      
      if (data.urlsWithContent && Array.isArray(data.urlsWithContent)) {
        console.log(`📊 Processing ${data.urlsWithContent.length} URLs with content`);
        
        for (const item of data.urlsWithContent) {
          if (item.success && item.content) {
            results.push({
              url: item.url,
              content: item.content
            });
            console.log(`✅ Added content from: ${item.url}`);
          } else {
            console.log(`❌ Skipped ${item.url}: ${item.error || 'No content'}`);
          }
        }
      }
      
      console.log(`✅ Successfully processed ${results.length} URLs with content`);
      return results;
      
    } catch (error) {
      console.error('❌ Search and fetch error:', error);
      return [];
    }
  } catch (error) {
    console.error('❌ Integrated search error:', error);
    return [];
  }
}

// Calculator utility
export const calculator = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => b !== 0 ? a / b : 'Error: Cannot divide by zero',
  
  evaluate: (expression: string) => {
    try {
      // Clean the expression to only allow safe math operations
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      if (!sanitized) return 'Error: Invalid expression';
      
      // Use Function constructor for safe evaluation
      const result = Function(`"use strict"; return (${sanitized})`)();
      
      if (typeof result === 'number' && !isNaN(result)) {
        return result;
      } else {
        return 'Error: Invalid calculation result';
      }
    } catch {
      return 'Error: Invalid expression';
    }
  }
};

// This function is now deprecated - use the Edge Function instead
export async function getOllamaResponse(prompt: string, ollamaUrl?: string): Promise<string> {
  return 'This function is deprecated. Use the Edge Function instead.';
}