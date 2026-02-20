import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import OpenAI from "npm:openai";

// Konfigurera CORS så att din frontend får anropa funktionen
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Hantera CORS preflight request (webbläsaren kollar om den får anropa)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Hämta data från requesten
    const { nodeId, content, action = "analyze" } = await req.json();

    if (!nodeId) {
      throw new Error("Missing nodeId");
    }

    // Hantera tom text (kan hända om man klickar på en tom nod)
    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return new Response(JSON.stringify({ error: "Content is empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // 3. Initiera Supabase Client (för att spara resultatet)
    // Vi använder Auth-headern från requesten för att respektera RLS (säkerhet)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY environment variable");
    }

    // 4. Initiera OpenAI Client (men peka den mot Groq)
    const groq = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    let systemPrompt = "";

    if (action === "organize") {
      systemPrompt = `
        You are an expert editor and structuring assistant.
        Your task is to organize the user's text to improve readability and structure.
        
        Rules:
        1. Use HTML tags compatible with Tiptap: <h1>, <h2>, <p>, <ul>, <li>, <strong>.
        2. Create a descriptive <h1> title if missing.
        3. Use <h2> for sections.
        4. Convert lists to <ul> or <ol>.
        5. Split long text into <p>.
        6. DO NOT change the meaning or tone.
        7. DO NOT add new information.
        8. Keep the language exactly as provided (Swedish).
        
        Return a JSON object: { "content": "<html_string>" }
        Return ONLY raw JSON.
      `;
    } else {
      // Default: Analyze (Summary + Tags)
      systemPrompt = `
        You are an AI assistant for a thinking tool. 
        Analyze the user's text.
        Return a JSON object with:
        - "summary": A concise summary (max 2 sentences) in Swedish.
        - "tags": An array of max 3 relevant tags (single words, lowercase) in Swedish.
        
        Return ONLY raw JSON. No markdown formatting.
      `;
    }

    // 5. Anropa AI (Groq - Llama 3)
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: content,
        },
      ],
      model: "llama-3.3-70b-versatile", // Snabb och smart modell
      temperature: 0.5,
      response_format: { type: "json_object" }, // Tvinga JSON-svar
    });

    const aiResponse = completion.choices[0].message.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    const parsedData = JSON.parse(aiResponse);

    // 6. Uppdatera databasen med resultatet beroende på action
    let updateData = {};
    if (action === "organize") {
      updateData = {
        content: parsedData.content, // Uppdatera själva texten
        is_processing: false,
      };
    } else {
      updateData = {
        summary: parsedData.summary,
        ai_tags: parsedData.tags,
        is_processing: false,
      };
    }

    const { error: updateError } = await supabaseClient
      .from("nodes")
      .update(updateData)
      .eq("id", nodeId);

    if (updateError) throw updateError;

    // 7. Returnera svar till frontend
    return new Response(JSON.stringify({ success: true, data: parsedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
