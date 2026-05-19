import fs from "fs";

function main() {
    const p = "src/lib/core/processors/QualificationProcessor.ts";
    let c = fs.readFileSync(p, "utf-8");
    
    // Replace (supabase.from("table" as any) as any) with supabase.from("table")
    c = c.replace(/\(supabase\.from\("([^"]+)" as any\) as any\)/g, 'supabase.from("$1")');
    
    // Replace specific analysis as any
    c = c.replace(/analisis_profundo: analysis as any,/g, 'analisis_profundo: analysis as unknown as Record<string, unknown>,');
    
    // Replace remaining generic as any
    c = c.replace(/as any/g, 'as unknown');
    
    fs.writeFileSync(p, c);
    console.log("Fixed any casts in " + p);
}

main();
