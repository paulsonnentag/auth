import { AuthProvider } from '../../packages/auth-provider-automerge-repo/dist/index'
import * as Auth from '../../packages/auth/dist/index'
import { Repo } from '@automerge/automerge-repo'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { DummyStorageAdapter } from './DummyStorageAdapter'

const alice = ((window as any).alice = await createUser('alice', true))
const bob = ((window as any).bob = await createUser('bob', false))

// invite bob
const { seed: bobInviteCode } = alice.team.inviteMember()

await bob.authProvider.addInvitation({
  shareId: alice.team.id,
  invitationSeed: bobInviteCode,
})

interface CounterDoc {
  counter: number
}

const aliceHandle = alice.repo.create<CounterDoc>()

aliceHandle.change(doc => {
  doc.counter = 100
})

setTimeout(() => {
  const bobHandle = bob.repo.find<CounterDoc>(aliceHandle.url)

  console.log('load doc')

  bobHandle.doc().then(doc => {
    console.log('doc', doc)
  })
}, 2000)
//localStorage.setItem('debug', 'localfirst:auth*')

async function createUser(name: string, withTeam: boolean) {
  const storage = new DummyStorageAdapter()

  const user = Auth.createUser(name)
  const { userId } = user
  const device = Auth.createDevice(userId, `${name}'s device`)
  const context = { user, device }

  const authProvider = new AuthProvider({ user, device, storage })

  const repo = new Repo({
    network: [authProvider.wrap(new BrowserWebSocketClientAdapter('ws://localhost:3030'))],
    storage,
  })

  let team
  if (withTeam) {
    // create a team
    team = Auth.createTeam(`team ${name}`, context)
    await authProvider.addTeam(team)

    // get the server's public keys
    const response = await fetch(`http://localhost:3030/keys`)
    const keys = await response.json()

    // add the server's public keys to the team
    team.addServer({ host: 'localhost', keys })

    // register the team with the server
    await fetch(`http://localhost:3030/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serializedGraph: team.save(),
        teamKeyring: team.teamKeyring(),
      }),
    })
  }

  repo.networkSubsystem.on('peer', payload => {
    console.log(`${name} is connected`, payload)
  })

  return {
    team,
    authProvider,
    repo,
    context,
  }
}

function App() {
  return 'hello world'
}

export default App
