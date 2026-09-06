from pathlib import Path

experience = Path('apps/web/src/components/battle/battle-experience.tsx')
text = experience.read_text()
old = """  const attackRange = useMemo(() => {\n    const result = new Set<string>()\n    if (!localPlacement) return result\n    for (const position of [\n      { x: localPlacement.position.x + 1, y: localPlacement.position.y },\n      { x: localPlacement.position.x - 1, y: localPlacement.position.y },\n      { x: localPlacement.position.x, y: localPlacement.position.y + 1 },\n      { x: localPlacement.position.x, y: localPlacement.position.y - 1 },\n    ]) {\n      if (\n        position.x >= 0 &&\n        position.x < tactical.width &&\n        position.y >= 0 &&\n        position.y < tactical.height\n      ) {\n        result.add(positionKey(position))\n      }\n    }\n    return result\n  }, [localPlacement, tactical.height, tactical.width])\n"""
new = """  const attackRange = useMemo(() => {\n    const result = new Set<string>()\n    if (!localPlacement) return result\n\n    const minimumRange = selectedAttackTechnique?.minimumRange ?? 1\n    const maximumRange = selectedAttackTechnique?.maximumRange ?? 1\n    for (let y = 0; y < tactical.height; y += 1) {\n      for (let x = 0; x < tactical.width; x += 1) {\n        const distance =\n          Math.abs(x - localPlacement.position.x) + Math.abs(y - localPlacement.position.y)\n        if (distance >= minimumRange && distance <= maximumRange) {\n          result.add(positionKey({ x, y }))\n        }\n      }\n    }\n    return result\n  }, [\n    localPlacement,\n    selectedAttackTechnique?.maximumRange,\n    selectedAttackTechnique?.minimumRange,\n    tactical.height,\n    tactical.width,\n  ])\n"""
if old not in text:
    raise SystemExit('attackRange anchor not found')
text = text.replace(old, new, 1)
experience.write_text(text)

directional = Path('apps/web/src/components/battle/battle-directional-attack-assist.tsx')
text = directional.read_text()
old = """    .filter(({ position }) => {\n      if (direction.dx !== 0) {\n        return (\n          position.y === origin.y &&\n          Math.sign(position.x - origin.x) === direction.dx &&\n          position.x !== origin.x\n        )\n      }\n      return (\n        position.x === origin.x &&\n        Math.sign(position.y - origin.y) === direction.dy &&\n        position.y !== origin.y\n      )\n    })\n    .sort(\n      (left, right) =>\n        Math.abs(left.position.x - origin.x) +\n        Math.abs(left.position.y - origin.y) -\n        (Math.abs(right.position.x - origin.x) + Math.abs(right.position.y - origin.y)),\n    )\n"""
new = """    .map((entry) => {\n      const deltaX = entry.position.x - origin.x\n      const deltaY = entry.position.y - origin.y\n      const forward = deltaX * direction.dx + deltaY * direction.dy\n      const perpendicular = direction.dx !== 0 ? Math.abs(deltaY) : Math.abs(deltaX)\n      const distance = Math.abs(deltaX) + Math.abs(deltaY)\n      return { ...entry, forward, perpendicular, distance }\n    })\n    .filter((entry) => entry.forward > 0)\n    .sort(\n      (left, right) =>\n        left.perpendicular - right.perpendicular ||\n        right.forward - left.forward ||\n        left.distance - right.distance,\n    )\n"""
if old not in text:
    raise SystemExit('target direction anchor not found')
text = text.replace(old, new, 1)
directional.write_text(text)
