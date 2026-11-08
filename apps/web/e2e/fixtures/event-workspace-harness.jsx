import React from 'react'
import { createRoot } from 'react-dom/client'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { EventWorkspaceClient } from '@/components/master/events/event-workspace-client'
import './production-styles'

// Actual production components/styles. HTTP/session are explicit local fixtures;
// native PostgreSQL tests own authority, concurrency and XP persistence proof.
const definition = {
  schemaVersion: 1,
  eventKey: 'event.ready',
  templateKey: 'template.navigation',
  contentVersion: 3,
  title: 'Frostmere watch — a guided gathering',
  summary: 'Follow the path to the watchtower.',
  internalNotes: '',
  family: 'regional-event',
  scope: { type: 'region', key: 'verdant-expanse' },
  phases: [
    {
      id: 'watch',
      name: 'Watchtower gathering',
      objectives: [
        {
          id: 'visit',
          type: 'discover',
          referenceKey: 'objective.watchtower',
          target: 1,
          worldNavigation: {
            sectorId: 'verdant-expanse',
            x: 12,
            y: 4,
            autoPath: true,
            guidance: 'exact',
          },
        },
      ],
      effects: [],
      cleanupEffects: [],
      transition: { type: 'elapsed', afterSeconds: 600 },
    },
  ],
  rewardPackageRefs: [],
  aftermathRefs: [],
}
const run = {
  runId: '22222222-2222-4222-8222-222222222222',
  eventKey: definition.eventKey,
  title: definition.title,
  category: 'world-events',
  definitionVersionId: '33333333-3333-4333-8333-333333333333',
  lifecycleStatus: 'live',
  stateVersion: 1,
  scopeType: 'region',
  scopeKey: 'verdant-expanse',
  currentPhaseId: 'watch',
  scheduledStartAt: '2026-10-25T12:00:00Z',
  scheduledEndAt: '2026-10-25T16:00:00Z',
  startedAt: '2026-10-25T12:00:00Z',
  cleanupStatus: 'not-required',
  updatedAt: '2026-10-25T12:00:00Z',
}
window.__eventRequests = []
let castDraft = null
let trialDraft = null
let combatDraft = null
const trialNpc = {
  id: 'ea82f11d-41df-4c5d-bba6-727904e95de8',
  name: 'Forge Sentinel',
  sectorId: 'emberreach',
}
const challengeNpc = {
  id: '7cc73d08-0742-4b08-8f96-8e56294073cb',
  name: 'Ashen Sentinel',
  sectorId: 'emberreach',
}
window.fetch = async (input, options) => {
  if (input === '/api/master/events/story-npcs')
    return Response.json({
      npcs: [
        {
          id: '39076058-5dba-457a-899c-d57b958540ca',
          name: 'Frostmere Keeper',
          portraitRef: 'portrait.starter.wayfarer-01',
          revision: 3,
        },
        {
          id: 'ec9f4cb3-d9f7-4d34-a9d8-a1f1a7c6d0f9',
          name: 'Harbor Watch',
          portraitRef: null,
          revision: 2,
        },
      ].filter((npc) => npc.id !== window.__retiredStoryNpc),
    })
  if (input === '/api/master/events/restoration-trial-npcs')
    return Response.json({
      sectors: [
        { id: 'verdant-expanse', name: 'Verdant Expanse' },
        { id: 'emberreach', name: 'Emberreach' },
        { id: 'frostmere', name: 'Frostmere' },
      ],
    })
  if (input.startsWith('/api/master/events/restoration-trial-npcs?npcId=')) {
    if (window.__holdTrialNpcLookup) {
      await new Promise((resolve) => {
        window.__releaseTrialNpcLookup = resolve
      })
    }
    const npcs = window.__retiredTrialNpc ? [challengeNpc] : [trialNpc, challengeNpc]
    return Response.json({ npc: npcs.find((npc) => input.endsWith(`npcId=${npc.id}`)) ?? null })
  }
  if (input.startsWith('/api/master/events/restoration-trial-npcs?sectorId=')) {
    const query = new URL(input, window.location.origin).searchParams
    if (query.get('view') === 'tags') {
      return Response.json({
        tags: query.get('sectorId') === 'emberreach' ? ['ashbound-raider', 'wolf'] : [],
      })
    }
    return Response.json({
      npcs: input.endsWith('sectorId=emberreach')
        ? (window.__retiredTrialNpc ? [challengeNpc] : [trialNpc, challengeNpc]).map(
            ({ id, name }) => ({ id, name }),
          )
        : [],
    })
  }
  const body = JSON.parse(options.body)
  window.__eventRequests.push({ path: input, body })
  if (input === '/api/master/events') {
    if (body.operation === 'catalogue')
      return Response.json({
        catalogue: {
          events: [
            {
              eventKey: 'event.ready',
              title: definition.title,
              category: 'world-events',
              scope: definition.scope,
              category: 'world-events',
              publishedVersion: 3,
              draftVersion: null,
            },
            {
              eventKey: 'event.stale',
              title: 'Older private draft',
              category: 'world-events',
              scope: definition.scope,
              category: 'world-events',
              publishedVersion: 3,
              draftVersion: 2,
            },
            {
              eventKey: 'event.story',
              title: 'A separate Story Campaign',
              category: 'story-campaigns',
              scope: definition.scope,
              publishedVersion: null,
              draftVersion: 1,
            },
          ],
          rewards: [
            { key: 'reward.watch', label: '25 Character XP · v1', budget: 'budget.watch' },
            { key: 'reward.recovery', label: '10 Character XP · v1', budget: 'budget.forge' },
            { key: 'reward.trial', label: '40 Character XP · v1', budget: 'budget.forge' },
          ],
        },
      })
    if (body.operation === 'load')
      return Response.json({
        workspace: {
          draft:
            body.eventKey === 'event.restoration-trial'
              ? trialDraft
              : body.eventKey === 'event.ashen-sentinel'
                ? combatDraft
                : body.eventKey === 'event.cast-check'
                  ? castDraft
                  : body.eventKey === 'event.stale'
                    ? {
                        definition: { ...definition, eventKey: 'event.stale' },
                        baseVersion: 2,
                        draftVersion: 2,
                      }
                    : null,
          current: ['event.restoration-trial', 'event.ashen-sentinel'].includes(body.eventKey)
            ? null
            : { definition, definitionVersion: 3 },
          versions: [{ definitionVersion: 3, current: true, publishedAt: '2026-10-25T12:00:00Z' }],
        },
      })
    if (body.operation === 'publish')
      return Response.json(
        { error: { message: 'Event definition changed. Reload before publishing.' } },
        { status: 409 },
      )
    if (body.operation === 'save-draft') {
      const draft = {
        definition: body.definition,
        baseVersion: body.baseVersion,
        draftVersion: (body.expectedDraftVersion ?? 0) + 1,
      }
      if (body.definition.eventKey === 'event.cast-check') castDraft = draft
      if (body.definition.eventKey === 'event.restoration-trial') trialDraft = draft
      if (body.definition.eventKey === 'event.ashen-sentinel') combatDraft = draft
      return Response.json({ draft })
    }
    if (body.operation === 'validate')
      return Response.json({ validation: { valid: true, issues: [] } })
    if (body.operation === 'preview')
      return Response.json({
        preview: {
          title: body.definition.title,
          eventKey: body.definition.eventKey,
          scope: body.definition.scope,
          phaseCount: 1,
          selectedPhase: {
            name: body.definition.phases[0].name,
            objectiveCount: 1,
            transitionType: 'elapsed',
          },
          rewardPackageRefs: body.definition.rewardPackageRefs,
        },
      })
    if (body.operation === 'schedule')
      return Response.json({
        scheduled:
          body.eventKey === 'event.stale'
            ? { runId: '44444444-4444-4444-8444-444444444444', stateVersion: 7 }
            : { runId: run.runId, stateVersion: 1 },
      })
    if (body.operation === 'cancel-scheduled') {
      if (
        body.runId !== '44444444-4444-4444-8444-444444444444' ||
        body.expectedStateVersion !== 7 ||
        !body.confirmed
      )
        return Response.json(
          { error: { message: 'Wrong Event cancellation target or confirmation.' } },
          { status: 409 },
        )
      return Response.json({ transition: { lifecycleStatus: 'cancelled' } })
    }
  }
  if (body.operation === 'list') return Response.json({ runs: [run] })
  if (body.operation === 'read')
    return Response.json({
      dashboard: {
        run,
        activeEffects: [],
        phases: [
          {
            phaseId: 'watch',
            ordinal: 0,
            status: run.lifecycleStatus === 'live' ? 'live' : 'completed',
            objectives: [{ objectiveId: 'visit', status: 'active', progress: 0, target: 1 }],
          },
        ],
        participants: [],
        claims: [
          {
            reservationId: 'prior-claim',
            characterId: 'prior-character',
            rewardPackageRef: 'reward.watch',
            executed: true,
            appliedAmount: 25,
            executedAt: '2026-10-25T12:00:00Z',
          },
        ],
        personalRewardsPendingCount: 1,
        personalRewards: [
          {
            attemptId: 'fixture-attempt',
            characterId: 'fixture-character',
            completedAt: '2026-10-25T12:00:00Z',
            awardedXp: 0,
            itemName: 'Realm key',
            itemClaimPending: true,
          },
        ],
        cleanupRequirements: [],
        chronicle: null,
      },
    })
  if (body.operation === 'operate') {
    if (body.expectedStateVersion !== run.stateVersion)
      return Response.json({ error: { message: 'Event state changed.' } }, { status: 409 })
    run.lifecycleStatus = {
      pause: 'paused',
      resume: 'live',
      stop: 'resolving',
      end: 'ended',
      'emergency-stop': 'emergency-stopped',
      archive: 'archived',
    }[body.command]
    run.stateVersion++
    return Response.json({ result: run })
  }
  throw new Error(`Unexpected fixture request: ${input} ${body.operation}`)
}
createRoot(document.getElementById('root')).render(
  <MasterPanelShell
    access={{
      userId: 'fixture-owner',
      accessVersion: 1,
      roles: ['game-owner'],
      specialCapabilities: [],
      effectiveCapabilities: ['master.access', 'events.author', 'events.operate'],
    }}
    activeSection="events"
    title="Events & Live Ops"
    description="Local production-component verification"
  >
    <EventWorkspaceClient canPublish canUseGlobalScope canEmergencyStop canManageNpcs />
  </MasterPanelShell>,
)
