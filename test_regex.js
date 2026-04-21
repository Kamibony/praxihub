const fs = require('fs');
const content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');
const trRegex = /<td className="px-6 py-4">\s*<span className=\{`px-3 py-1 rounded-full text-xs font-bold[\s\S]*?<\/span>\s*<\/td>\s*<td className="px-6 py-4 text-sm whitespace-nowrap">[\s\S]*?<\/td>/;

console.log("Match exists:", trRegex.test(content));

const oldRowStr = `                        <td className="px-6 py-4">
                          <span
                            className={\`px-3 py-1 rounded-full text-xs font-bold \${
                              item.status === "PENDING_ORG_APPROVAL"
                                ? "bg-blue-100 text-blue-800"
                                : item.status === "APPROVED"
                                  ? "bg-green-100 text-green-800"
                                  : item.status === "NEEDS_REVIEW"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : item.status === "ANALYZING"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-gray-100 text-gray-800"
                            }\`}
                          >
                            {item.status === "PENDING_ORG_APPROVAL"
                              ? "Čeká na schválení (Firma)"
                              : item.status === "NEEDS_REVIEW"
                                ? "Ke kontrole (IVP)"
                                : item.status === "ANALYZING"
                                  ? "AI Zpracování"
                                  : item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          {item.status === "PENDING_ORG_APPROVAL" ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveOrg(item.id);
                                }}
                                className="text-green-600 hover:text-green-900 font-bold hover:underline"
                              >
                                Schválit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectOrg(item.id);
                                }}
                                className="text-red-600 hover:text-red-900 font-bold hover:underline"
                              >
                                Zamítnout
                              </button>
                            </>
                          ) : (
                            <>
                              <a
                                href={\`mailto:\${item.studentEmail}?subject=Dotaz k praxi&body=Dobrý den, ohledně vaší smlouvy...\`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-500 hover:text-gray-700 mr-3"
                                title="Poslat e-mail studentovi"
                              >
                                E-mail
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlacement(item);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                              >
                                Detail
                              </button>
                            </>
                          )}
                        </td>`;
console.log("String exists directly?", content.includes(oldRowStr));
