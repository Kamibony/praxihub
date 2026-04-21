const fs = require('fs');
let content = fs.readFileSync('apps/web/app/admin/dashboard/page.tsx', 'utf8');

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

content = content.replace(
  /const handleApproveOrg = async \(id: string\) => \{/,
  `${matchHandler}\n\n  const handleApproveOrg = async (id: string) => {`
);

fs.writeFileSync('apps/web/app/admin/dashboard/page.tsx', content);
