import fs from "fs";

function main() {
    const files = [
        "src/components/dashboard/SummaryManager.tsx",
        "src/components/dashboard/ChartManager.tsx"
    ];

    for (const file of files) {
        let c = fs.readFileSync(file, "utf-8");
        // We replace value="agendamientos" with value="appointments"
        c = c.replace(/value="agendamientos"/g, 'value="appointments"');
        
        fs.writeFileSync(file, c);
        console.log("Updated " + file);
    }
}

main();
