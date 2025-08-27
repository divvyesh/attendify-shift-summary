import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  fileName: string;
  headers: string[];
  sampleRows: any[][];
  localGuess?: {
    type: string;
    confidence: number;
  };
}

interface ColumnMapping {
  original: string;
  suggested: string;
  confidence: number;
}

interface AIAnalysisResponse {
  fileType: 'schedule' | 'punches' | 'combined' | 'unknown';
  confidence: number;
  reasoning: string;
  columnMappings: ColumnMapping[];
  warnings: string[];
  suggestions: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { fileName, headers, sampleRows, localGuess }: AnalysisRequest = await req.json();

    console.log('AI File Analysis Request:', { fileName, headers: headers.length, sampleRows: sampleRows.length });

    // Create prompt for AI analysis
    const prompt = `You are an expert at analyzing attendance data files. 

FILE: ${fileName}
HEADERS: ${headers.join(', ')}
LOCAL ANALYSIS: ${localGuess ? `Type: ${localGuess.type}, Confidence: ${localGuess.confidence}%` : 'None'}

SAMPLE DATA (first few rows):
${sampleRows.map((row, i) => `Row ${i + 1}: ${row.join(', ')}`).join('\n')}

Please analyze this attendance file and provide:
1. File type classification (schedule/punches/combined/unknown)
2. Confidence level (0-100)
3. Column mappings to standard attendance fields
4. Reasoning for your analysis
5. Any warnings or suggestions

Standard attendance fields:
- employee_name, employee_id, store, date, shift
- scheduled_in, scheduled_out, actual_in, actual_out
- status, hours_worked, attendance_pct

Respond with a JSON object matching this exact structure:
{
  "fileType": "schedule|punches|combined|unknown",
  "confidence": 85,
  "reasoning": "Detailed explanation of analysis",
  "columnMappings": [
    {
      "original": "Employee Name",
      "suggested": "employee_name", 
      "confidence": 95
    }
  ],
  "warnings": ["Any issues found"],
  "suggestions": ["Recommendations for user"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert data analyst specializing in attendance and workforce management systems. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content) as AIAnalysisResponse;

    console.log('AI Analysis Result:', { 
      fileType: aiResponse.fileType, 
      confidence: aiResponse.confidence,
      mappingsCount: aiResponse.columnMappings.length 
    });

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-file-analyzer function:', error);
    
    const errorResponse = {
      fileType: 'unknown',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      columnMappings: [],
      warnings: ['AI analysis unavailable'],
      suggestions: ['Please review column mappings manually']
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});