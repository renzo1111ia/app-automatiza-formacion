import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'MASTER_DOSSIER.md');
        const content = fs.readFileSync(filePath, 'utf8');
        
        return NextResponse.json({ content });
    } catch (error) {
        console.error("Error serving docs content:", error);
        return NextResponse.json({ error: "Failed to read documentation file" }, { status: 500 });
    }
}
