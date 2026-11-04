# Damage Up damage types

Owner approved November 4: expand Damage Up to All Damage (existing default), Pierce, Fire, Water, Ice and Storm. A single tag can select any nonempty combination of specific types, sharing its percentage and duration; All Damage is exclusive. Separate applications may carry distinct percentages/types. Preserve old tags and frozen battle captures. Only matching direct damage packets receive each bonus once, including authoritative battle execution, preview, delayed/Controlled/persistent sources and modifiers. Already-captured periodic damage is not amplified again; existing DoT capture rules remain authoritative.

Approaches: one type per tag was simpler but restricts authoring diversity; approved multi-selection uses one shared packet matcher for ordinary Damage Up statuses and canonical Damage Up modifiers. Absent `damageTypes` means All Damage; `damageTypes` is a distinct nonempty array of `pierce|fire|water|ice|storm`. Retained scalar `elementFilter` remains readable for modifier compatibility. Invalid empty, duplicate, unknown or conflicting scopes are rejected. Other statuses cannot carry this tuning.

Reports and active/captured/stacked/copied status details show each application's actual types. Copy retains scope; expiry and Dispel use ordinary lifecycle. Existing absent-scope history retains its behavior. No unrelated balance, resource, duration or catalogue change.

Delivery: separate Damage Up PR stacked on Seal #1014. Owner authorizes one coordinated live release of both after final exact-head checks, required additive Seal registration and production verification; do not release either alone or rewrite Owner drafts/inventory/history. No broad automatic content republication. Human acceptance stays open.
