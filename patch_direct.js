const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

// Replace FilterStatus type definition
content = content.replace(
  /type FilterStatus =[\s\S]*?;/,
  `type FilterStatus =
  | "ALL"
  | "PENDING_MATCH"
  | "PENDING_INSTITUTION"
  | "PENDING_COORDINATOR"
  | "APPROVED"
  | "ACTIVE"
  | "EVALUATION"
  | "CLOSED";`
);

// Add missing state for organizations and matchmaking
if (!content.includes('const [organizations, setOrganizations]')) {
  content = content.replace(
    /const \[placements, setPlacements\] = useState<any\[\]>\(\[\]\);/,
    `const [placements, setPlacements] = useState<any[]>([]);\n  const [organizations, setOrganizations] = useState<any[]>([]);\n  const [matchmakingOrgId, setMatchmakingOrgId] = useState<string>("");\n  const [linkingPlacementId, setLinkingPlacementId] = useState<string | null>(null);`
  );
}

// Add organization fetching inside useEffect
if (!content.includes('collection(db, "organizations")')) {
  content = content.replace(
    /const unsubscribeAuth = onAuthStateChanged\(auth, \(user\) => \{/,
    `const unsubOrgs = onSnapshot(query(collection(db, "organizations")), (snap) => {
          setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });\n\n    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {`
  );
}

// Add handleMatchPlacement
if (!content.includes('const handleMatchPlacement')) {
  content = content.replace(
    /const handleRejectOrg = async \(placementId: string\) => \{/,
    `const handleMatchPlacement = async (placementId: string) => {
    if (!matchmakingOrgId) {
      alert("Vyberte organizaci pro propojení.");
      return;
    }
    try {
      const placementRef = doc(db, "placements", placementId);
      await updateDoc(placementRef, {
        organizationId: matchmakingOrgId,
        status: "PENDING_INSTITUTION",
        updatedAt: new Date().toISOString()
      });
      alert("Praxe úspěšně propojena s organizací.");
      setLinkingPlacementId(null);
      setMatchmakingOrgId("");
    } catch (error) {
      console.error("Chyba při propojování:", error);
      alert("Nepodařilo se propojit praxi.");
    }
  };

  const handleRejectOrg = async (placementId: string) => {`
  );
}

// Replace the status cards UI block
content = content.replace(
  /<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">[\s\S]*?<div className="overflow-x-auto">/,
  `<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
              <div
                className={getCardClasses("ALL")}
                onClick={() => setFilterStatus("ALL")}
              >
                <div className="text-2xl font-bold">{placements.length}</div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Vše
                </div>
              </div>
              <div
                className={getCardClasses("PENDING_MATCH")}
                onClick={() => setFilterStatus("PENDING_MATCH")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "PENDING_MATCH").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Match
                </div>
              </div>
              <div
                className={getCardClasses("PENDING_INSTITUTION")}
                onClick={() => setFilterStatus("PENDING_INSTITUTION")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "PENDING_INSTITUTION").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Čeká Firma
                </div>
              </div>
              <div
                className={getCardClasses("PENDING_COORDINATOR")}
                onClick={() => setFilterStatus("PENDING_COORDINATOR")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "PENDING_COORDINATOR").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Čeká Koord
                </div>
              </div>
              <div
                className={getCardClasses("APPROVED")}
                onClick={() => setFilterStatus("APPROVED")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "APPROVED").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Schváleno
                </div>
              </div>
              <div
                className={getCardClasses("ACTIVE")}
                onClick={() => setFilterStatus("ACTIVE")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "ACTIVE").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Aktivní
                </div>
              </div>
              <div
                className={getCardClasses("EVALUATION")}
                onClick={() => setFilterStatus("EVALUATION")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "EVALUATION").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Hodnocení
                </div>
              </div>
              <div
                className={getCardClasses("CLOSED")}
                onClick={() => setFilterStatus("CLOSED")}
              >
                <div className="text-2xl font-bold">
                  {placements.filter((p) => p.status === "CLOSED").length}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 opacity-80">
                  Uzavřeno
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">`
);

// Fix the headers in the main table
content = content.replace(
  /<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">\s*Status\s*<\/th>\s*<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">\s*Akce\s*<\/th>/g,
  `<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matchmaking</th>
   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akce</th>`
);

// We need to inject Matchmaking cell into the first table body
// The table structure uses `.map((item) => (`
// Let's replace the whole body render block for Placements table
const oldTableBody = /{placements[\s\S]*?if \(filterStatus === "ALL"\) return true;[\s\S]*?return p\.status === filterStatus;[\s\S]*?}\)[\s\S]*?\.map\(\(item\) => \([\s\S]*?key=\{item\.id\}[\s\S]*?<td className="px-6 py-4">[\s\S]*?<span[\s\S]*?className=\{`px-3 py-1 rounded-full text-xs font-bold[\s\S]*?<\/span>\s*<\/td>\s*<td className="px-6 py-4 text-sm whitespace-nowrap">[\s\S]*?<\/td>\s*<\/tr>/;

// We will do a specific string replace for the Status cell and Action cell
let modified = content;
const trRegex = /<tr[^>]*key=\{item\.id\}[^>]*>([\s\S]*?)<\/tr>/g;
let foundPlacementsTable = false;

modified = modified.replace(trRegex, (match, trContent) => {
    if(trContent.includes('item.studentEmail') && !trContent.includes('Vyberte organizaci...')) {
        foundPlacementsTable = true;
        let newContent = trContent.replace(
            /<td className="px-6 py-4">\s*<span className=\{`px-3 py-1 rounded-full text-xs font-bold[\s\S]*?<\/span>\s*<\/td>\s*<td className="px-6 py-4 text-sm whitespace-nowrap">[\s\S]*?<\/td>/,
            `<td className="px-6 py-4">
                            <span
                              className={\`px-3 py-1 rounded-full text-xs font-bold \${
                                item.status === "PENDING_MATCH"
                                  ? "bg-purple-100 text-purple-800"
                                  : item.status === "PENDING_INSTITUTION"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.status === "PENDING_COORDINATOR"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : item.status === "APPROVED"
                                        ? "bg-green-100 text-green-800"
                                        : item.status === "ACTIVE"
                                          ? "bg-teal-100 text-teal-800"
                                          : item.status === "EVALUATION"
                                            ? "bg-orange-100 text-orange-800"
                                            : item.status === "CLOSED"
                                              ? "bg-gray-100 text-gray-800"
                                              : "bg-gray-100 text-gray-800"
                              }\`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {item.status === "PENDING_MATCH" ? (
                              <div className="flex flex-col gap-1 min-w-[150px]">
                                <select
                                  className="text-xs p-1 border rounded"
                                  value={linkingPlacementId === item.id ? matchmakingOrgId : ""}
                                  onChange={(e) => {
                                    setLinkingPlacementId(item.id);
                                    setMatchmakingOrgId(e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="">Vyberte organizaci...</option>
                                  {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                  ))}
                                </select>
                                {linkingPlacementId === item.id && matchmakingOrgId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMatchPlacement(item.id);
                                    }}
                                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 mt-1"
                                  >
                                    Propojit
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlacement(item);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 font-medium"
                            >
                              Detail
                            </button>
                          </td>`
        );
        return match.replace(trContent, newContent);
    }
    return match;
});

content = modified;

fs.writeFileSync('apps/web/app/admin/dashboard/page.tsx', content);
