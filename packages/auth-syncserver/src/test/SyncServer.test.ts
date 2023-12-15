import { createTeam, device, loadTeam, type Team } from '@localfirst/auth'
import { eventPromise } from '@localfirst/auth-shared'
import { describe, expect, it } from 'vitest'
import { host, setup } from './helpers/setup.js'

describe('LocalFirstAuthSyncServer', () => {
  it('should start a server', async () => {
    const { url } = await setup()
    const response = await fetch(`http://${url}`)
    const text = await response.text()

    // the server responds with a string like "Sync server is running"
    expect(text).toContain('running')
  })

  it("should return the server's public keys", async () => {
    const { url, server } = await setup()
    const response = await fetch(`http://${url}/keys`)
    const keys = await response.json()

    // the keys look like keys
    expect(lookLikeServerKeys(keys)).toBe(true)

    // they match the server's public keys
    expect(server.publicKeys).toEqual(keys)
  })

  it('Alice can create a team', async () => {
    const { users, url } = await setup(['alice'])
    const { alice } = users

    // create a team
    const teamContext = { user: alice.user, device: alice.device }
    const team = createTeam('team A', teamContext)
    await alice.authProvider.addTeam(team)

    // get the server's public keys
    const response = await fetch(`http://${url}/keys`)
    const keys = await response.json()

    // add the server's public keys to the team
    team.addServer({ host, keys })

    // register the team with the server
    await fetch(`http://${url}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serializedGraph: team.save(),
        teamKeyring: team.teamKeyring(),
      }),
    })

    // when we're authenticated, we get a peer event
    const { peerId } = await eventPromise(alice.repo.networkSubsystem, 'peer')
    expect(peerId).toEqual(host)
  })

  it('Allows two users to communicate', async () => {
    const { users, url } = await setup(['alice', 'bob'])
    const { alice, bob } = users

    // create a team
    const teamContext = { user: alice.user, device: alice.device }

    const aliceTeam: Team = createTeam('team A', teamContext)
    await alice.authProvider.addTeam(aliceTeam)
    aliceTeam.addForTesting(bob.user, [], device.redactDevice(bob.device))

    // get the server's public keys
    const response = await fetch(`http://${url}/keys`)
    const keys = await response.json()

    // add the server's public keys to the team
    aliceTeam.addServer({ host, keys })

    // register the team with the server
    // (we don't await this because otherwise peer will fire before we're listening)
    void fetch(`http://${url}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serializedGraph: aliceTeam.save(),
        teamKeyring: aliceTeam.teamKeyring(),
      }),
    })

    // when we're authenticated, we get a peer event
    await eventPromise(alice.repo.networkSubsystem, 'peer')

    // We are making sure that bob is on the same team as alice and the server
    const bobTeam = loadTeam(
      aliceTeam.graph,
      { user: bob.user, device: bob.device },
      aliceTeam.teamKeyring()
    )
    await bob.authProvider.addTeam(bobTeam)

    await eventPromise(bob.repo.networkSubsystem, 'peer')

    // Now we are going to test that Bob is going to see alice's changes to the team
    aliceTeam.addRole('MANAGERS')

    // We need to wait Bob team to get updated so we can check that both teams are in sync
    await eventPromise(bobTeam, 'updated')

    expect(bobTeam.hasRole('MANAGERS')).toBe(true)

    // Alice creates a new document
    const aliceDocHandle = alice.repo.create<TestDoc>()
    aliceDocHandle.change(doc => (doc.foo = 'alice'))

    // Bob tries to access the doc
    const bobDocHandle = bob.repo.find<TestDoc>(aliceDocHandle.url)

    await eventPromise(bobDocHandle, 'change')

    expect(bobDocHandle.docSync()).toStrictEqual({ foo: 'alice' })
  })
})

const lookLikeServerKeys = (maybeKeyset: any) =>
  maybeKeyset.type === 'SERVER' &&
  maybeKeyset.name === host &&
  maybeKeyset.generation === 0 &&
  typeof maybeKeyset.encryption === 'string' &&
  typeof maybeKeyset.signature === 'string'

interface TestDoc {
  foo: string
}
