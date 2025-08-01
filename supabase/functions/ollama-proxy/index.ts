import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log('🚀 Simplified Ollama proxy starting...');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
  'Access-Control-Max-Age': '86400',
}

// Simple HTML text extraction function
function extractTextFromHTML(html: string): string {
  try {
    // Remove script and style tags completely
    let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove HTML tags
    cleanHtml = cleanHtml.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
    cleanHtml = cleanHtml.replace(/&amp;/g, '&');
    cleanHtml = cleanHtml.replace(/&lt;/g, '<');
    cleanHtml = cleanHtml.replace(/&gt;/g, '>');
    cleanHtml = cleanHtml.replace(/&quot;/g, '"');
    cleanHtml = cleanHtml.replace(/&#39;/g, "'");
    
    // Clean up whitespace
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    
    return cleanHtml;
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

serve(async (req) => {
  console.log(`📝 Received ${req.method} request to ${req.url}`);
  
  // Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Test endpoint
    if (req.url.includes('test')) {
      console.log('✅ Test endpoint hit');
      return new Response(JSON.stringify({ 
        status: 'working',
        timestamp: new Date().toISOString() 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse JSON
    let requestBody;
    try {
      console.log('📥 Reading request body...');
      const rawBody = await req.text();
      console.log(`📏 Request body length: ${rawBody.length}`);
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      requestBody = JSON.parse(rawBody);
      console.log('✅ Request body parsed successfully', { action: requestBody.action, model: requestBody.model });
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { prompt, model = 'FireFlies:latest', action } = requestBody;
    console.log(`🤖 Processing: action=${action}, model=${model}`);

    // Handle search action
    if (action === 'search') {
      console.log('🔍 Handling search request for:', requestBody.query);
      
      try {
        // Fungsi untuk mencari di DuckDuckGo
        const searchQuery = requestBody.query;
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
        
        console.log(`🔍 Searching DuckDuckGo: ${searchUrl}`);
        
        const searchResponse = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000)
        });
        
        if (!searchResponse.ok) {
          throw new Error(`DuckDuckGo search failed: ${searchResponse.status}`);
        }
        
        const html = await searchResponse.text();
        const results: string[] = [];
        const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null && results.length < 3) {
          try {
            const link = match[1];
            const url = new URL(link, 'https://duckduckgo.com');
            const realUrl = url.searchParams.get('uddg');
            if (realUrl) {
              const decodedUrl = decodeURIComponent(realUrl);
              results.push(decodedUrl);
              console.log(`🔗 Found URL: ${decodedUrl}`);
            }
          } catch (urlError) {
            console.warn(`⚠️ Failed to parse URL: ${match[1]}`);
          }
        }
        
        console.log(`✅ Found ${results.length} URLs from DuckDuckGo`);
        
        const urls: string[] = [];
        const urlsWithContent: any[] = [];
        
        // Fetch content for each URL found
        for (const url of results) {
          try {
            console.log(`📄 Fetching content from: ${url}`);
            const contentResponse = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              signal: AbortSignal.timeout(10000)
            });
            
            if (contentResponse.ok) {
              const html = await contentResponse.text();
              const content = extractTextFromHTML(html);
              
              if (content && content.length > 100) {
                urls.push(url);
                urlsWithContent.push({
                  url,
                  content: content.substring(0, 2000),
                  success: true
                });
                console.log(`✅ Content fetched from: ${url} (${content.length} chars)`);
              } else {
                urlsWithContent.push({
                  url,
                  error: 'Insufficient content',
                  success: false
                });
                console.log(`⚠️ Insufficient content from: ${url}`);
              }
            } else {
              urlsWithContent.push({
                url,
                error: `HTTP ${contentResponse.status}`,
                success: false
              });
              console.log(`❌ HTTP error ${contentResponse.status} from: ${url}`);
            }
          } catch (error) {
            urlsWithContent.push({
              url,
              error: error.message,
              success: false
            });
            console.error(`❌ Error fetching ${url}:`, error);
          }
        }
        
        console.log(`✅ Search completed: ${urls.length} URLs, ${urlsWithContent.filter(u => u.success).length} with content`);
        
        return new Response(JSON.stringify({ 
          urls,
          urlsWithContent
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('❌ Search error:', error);
        return new Response(JSON.stringify({ 
          urls: [],
          urlsWithContent: [],
          error: 'Search failed: ' + error.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle web scraping action
    if (action === 'web') {
      const targetUrl = requestBody.url;
      console.log('🌐 Handling web scraping request for:', targetUrl);
      
      if (!targetUrl) {
        return new Response(JSON.stringify({ 
          content: null,
          error: 'URL is required for web scraping'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      try {
        console.log(`📄 Fetching content from: ${targetUrl}`);
        const contentResponse = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout for single URL
        });
        
        if (!contentResponse.ok) {
          throw new Error(`HTTP ${contentResponse.status}`);
        }
        
        const html = await contentResponse.text();
        const content = extractTextFromHTML(html);
        
        if (!content || content.length < 50) {
          throw new Error('Insufficient content extracted');
        }
        
        console.log(`✅ Web content fetched: ${content.length} characters`);
        
        return new Response(JSON.stringify({ 
          content: content.substring(0, 5000), // Larger limit for single URL
          success: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('❌ Web scraping error:', error);
        return new Response(JSON.stringify({ 
          content: null,
          error: 'Web scraping failed: ' + error.message,
          success: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle get models
    if (action === 'get_models') {
      console.log('🔍 Fetching available models');
      const baseUrl = requestBody.baseUrl || 'http://170.64.163.129:11434';
      
      try {
        console.log(`Fetching from: ${baseUrl}/api/tags`);
        const modelsResponse = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`Models response: ${modelsResponse.status}`);
        
        if (!modelsResponse.ok) {
          throw new Error(`Models API error: ${modelsResponse.status}`);
        }
        
        const modelsData = await modelsResponse.json();
        console.log('✅ Models fetched successfully:', modelsData.models?.length || 0);
        
        return new Response(JSON.stringify({ models: modelsData.models || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('❌ Models fetch error:', error);
        return new Response(JSON.stringify({ 
          models: [], 
          error: 'Failed to fetch models' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle basic chat
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const baseUrl = requestBody.baseUrl || 'http://170.64.163.129:11434';
    console.log(`🔗 Making request to: ${baseUrl}/api/generate`);
    
    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });
      
      console.log(`🌐 Ollama response: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ollama error:', errorText);
        return new Response(
          JSON.stringify({ error: `Ollama error: ${response.status} - ${errorText}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const data = await response.json();
      console.log('✅ Success! Response received');
      
      return new Response(
        JSON.stringify({ response: data.response }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
      
    } catch (fetchError) {
      console.error('❌ Network error:', fetchError);
      return new Response(
        JSON.stringify({ error: `Network error: ${fetchError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ General error:', error);
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})