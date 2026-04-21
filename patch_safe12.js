const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

content = content.replace(
  /type FilterStatus =[\s\S]*?;/,
  `// Define filter type to match new state machine
type FilterStatus =
  | "ALL"
  | "PENDING_MATCH"
  | "PENDING_INSTITUTION"
  | "PENDING_COORDINATOR"
  | "APPROVED"
  | "ACTIVE"
  | "EVALUATION"
  | "CLOSED";`
);

if (!content.includes('const [organizations, setOrganizations]')) {
  content = content.replace(
    /const \[placements, setPlacements\] = useState<any\[\]>\(\[\]\);/,
    `const [placements, setPlacements] = useState<any[]>([]);\n  const [organizations, setOrganizations] = useState<any[]>([]);\n  const [matchmakingOrgId, setMatchmakingOrgId] = useState<string>("");\n  const [linkingPlacementId, setLinkingPlacementId] = useState<string | null>(null);`
  );
}

const orgFetchLogic = `
        // Fetch organizations for matchmaking
        const unsubOrgs = onSnapshot(query(collection(db, "organizations")), (snap) => {
          setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
`;
if (!content.includes('const unsubOrgs = onSnapshot')) {
  content = content.replace(
    /unsubscribeFirestore = onSnapshot\(q, \(snapshot\) => {/,
    `${orgFetchLogic}\n        unsubscribeFirestore = onSnapshot(q, (snapshot) => {`
  );
}

const matchHandler = `
  const handleMatchPlacement = async (placementId: string) => {
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
`;

if (!content.includes('const handleMatchPlacement')) {
  content = content.replace(
    /const handleRejectOrg = async \(placementId: string\) => {/,
    `${matchHandler}\n\n  const handleRejectOrg = async (placementId: string) => {`
  );
}

content = content.replace(
  /<div\n\s*className=\{getCardClasses\("ALL"\)\}[\s\S]*?<div\n\s*className=\{getCardClasses\("ANALYZING"\)\}[\s\S]*?<\/div>\n\s*<\/div>/,
  `<div
                className={getCardClasses("ALL")}
                onClick={() => setFilterStatus("ALL")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Vše</p>
                <p className="text-2xl font-bold text-gray-900">{placements.length}</p>
              </div>
              <div
                className={getCardClasses("PENDING_MATCH")}
                onClick={() => setFilterStatus("PENDING_MATCH")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Match</p>
                <p className="text-2xl font-bold text-purple-600">{placements.filter((p) => p.status === "PENDING_MATCH").length}</p>
              </div>
              <div
                className={getCardClasses("PENDING_INSTITUTION")}
                onClick={() => setFilterStatus("PENDING_INSTITUTION")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Čeká Firma</p>
                <p className="text-2xl font-bold text-blue-600">{placements.filter((p) => p.status === "PENDING_INSTITUTION").length}</p>
              </div>
              <div
                className={getCardClasses("PENDING_COORDINATOR")}
                onClick={() => setFilterStatus("PENDING_COORDINATOR")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Čeká Koord</p>
                <p className="text-2xl font-bold text-yellow-600">{placements.filter((p) => p.status === "PENDING_COORDINATOR").length}</p>
              </div>
              <div
                className={getCardClasses("APPROVED")}
                onClick={() => setFilterStatus("APPROVED")}
              >
                <p className="text-xs text-gray-500 uppercase font-bold">Schváleno</p>
                <p className="text-2xl font-bold text-green-600">{placements.filter((p) => p.status === "APPROVED").length}</p>
              </div>`
);

content = content.replace(
  /<th className="px-6 py-4 font-semibold text-left">Status<\/th>\s*<th className="px-6 py-4 font-semibold">Akce<\/th>/g,
  `<th className="px-6 py-4 font-semibold text-left">Status</th>
   <th className="px-6 py-4 font-semibold text-left">Matchmaking</th>
   <th className="px-6 py-4 font-semibold">Akce</th>`
);

const matchString = `{placements
                    .filter((p) => {
                      if (filterStatus === "ALL") return true;
                      return p.status === filterStatus;
                    })
                    .map((item) => (`;

const split = content.split(matchString);
if (split.length > 1) {
  const afterSplit = split[1];
  const trEndIndex = afterSplit.indexOf('</tr>');

  if (trEndIndex !== -1) {
    const oldRowContent = afterSplit.substring(0, trEndIndex);

    // We'll manually replace the row content with the new one
    // Just the cells we care about
    let newRowContent = oldRowContent.replace(
      /<td className="px-6 py-4">\s*<span[\s\S]*?<\/td>\s*<td className="px-6 py-4 text-sm whitespace-nowrap">[\s\S]*?<\/td>/,
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

    // Assemble it back
    content = split[0] + matchString + newRowContent + afterSplit.substring(trEndIndex);
    fs.writeFileSync('apps/web/app/admin/dashboard/page.tsx', content);
  }
}
