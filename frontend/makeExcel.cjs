const XLSX = require("xlsx");

const types = ["StreetLight", "Pothole", "Waste", "WaterLeak"];
const places = ["Avenue Mohammed V", "Rue Ibn Battouta", "Boulevard Pasteur", "Place du 9 Avril", "Rue de Fes", "Avenue des FAR"];
const descs = ["Streetlight not working", "Large pothole on the road", "Overflowing garbage bin", "Water leak on sidewalk"];
const prios = ["High", "Medium", "Low", "Critical"];

const rows = Array.from({ length: 12 }, (_, i) => ({
  issueId: `CITY-2026-${String(i + 1).padStart(3, "0")}`,
  issueType: types[i % 4],
  location: places[i % places.length],
  description: descs[i % 4],
  reportDate: "2026-11-19",
  priority: prios[i % 4],
  reportedBy: `Citizen${String(i + 1).padStart(2, "0")}`,
  assignedTo: `UrbanTeam0${(i % 3) + 1}`,
  status: "Reported",
}));
rows[11].priority = "Urgent"; // deliberately invalid row, to show the validation in the preview

const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "urban_issues");
XLSX.writeFile(wb, "../urban_issues.xlsx");
console.log("urban_issues.xlsx created with", rows.length, "rows");