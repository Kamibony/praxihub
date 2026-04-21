const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

const targetStr = `{filteredPlacements.map((item) => (`;
const targetIndex = content.indexOf(targetStr);

if (targetIndex !== -1) {
    const splitBefore = content.substring(0, targetIndex);
    let restOfContent = content.substring(targetIndex);

    // We want to replace the first row rendering after filteredPlacements.map
    const trRegex = /<td className="px-6 py-4">\s*<span className=\{`px-3 py-1 rounded-full text-xs font-bold[\s\S]*?<\/span>\s*<\/td>\s*<td className="px-6 py-4 text-sm whitespace-nowrap">[\s\S]*?<\/td>/;

    restOfContent = restOfContent.replace(
      trRegex,
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
                              <div className="flex flex-col gap-1 min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                                <select
                                  className="text-xs p-1 border border-gray-300 rounded"
                                  value={linkingPlacementId === item.id ? matchmakingOrgId : ""}
                                  onChange={(e) => {
                                    setLinkingPlacementId(item.id);
                                    setMatchmakingOrgId(e.target.value);
                                  }}
                                >
                                  <option value="">Vyberte organizaci...</option>
                                  {organizations && organizations.map(org => (
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
                            {item.status === "PENDING_COORDINATOR" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const placementRef = doc(db, "placements", item.id);
                                    updateDoc(placementRef, { status: "ACTIVE", updatedAt: new Date().toISOString() });
                                  }}
                                  className="text-green-600 hover:text-green-900 font-bold hover:underline mr-4"
                                >
                                  Schválit
                                </button>
                            )}
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

    content = splitBefore + restOfContent;
    fs.writeFileSync('apps/web/app/admin/dashboard/page.tsx', content);
} else {
    console.log("No filteredPlacements.map found");
}
