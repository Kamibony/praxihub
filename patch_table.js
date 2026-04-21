const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

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
                              {item.status === "PENDING_ORG_APPROVAL" ? "PENDING_INSTITUTION" : item.status}
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
