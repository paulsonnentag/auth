import { AuthProvider } from '../../packages/auth-provider-automerge-repo/dist/index'
import * as Auth from '../../packages/auth/dist/index'
import { Repo, AutomergeUrl } from '@automerge/automerge-repo'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { DummyStorageAdapter } from './DummyStorageAdapter'

const alice = ((window as any).alice = await createUser('alice', true))

interface CounterDoc {
  counter: number
}

/* reload data for alice */

const docUrl = 'automerge:zrjMfTdPeedDYqxqEwg5kq31swD' as AutomergeUrl

alice.repo.on('document', doc => {
  console.log('new doc', doc)
})

const handle = alice.repo.find<CounterDoc>(docUrl)

await handle.whenReady()

handle.change(doc => {
  doc.counter = doc.counter + 200
})

console.log(await handle.doc())

/**/

/* share data between peers */

const bob = ((window as any).bob = await createUser('bob', false))

// invite bob
const { seed: bobInviteCode } = alice.team.inviteMember()

await bob.authProvider.addInvitation({
  shareId: alice.team.id,
  invitationSeed: bobInviteCode,
})

//storeUserData({ name: 'bob', user: bob.user, device: bob.device, team: alice.team })

setTimeout(() => {
  const bobHandle = bob.repo.find<CounterDoc>(docUrl)

  console.log('load doc')

  bobHandle.doc().then(doc => {
    console.log('doc', doc)
  })
}, 2000)

/**/

//localStorage.setItem('debug', 'localfirst:auth*')

async function createUser(name: string, withTeam: boolean) {
  const storage = new DummyStorageAdapter()
  const storedUserData = loadUserData(name)

  let user, device

  if (storedUserData) {
    user = storedUserData.user
    device = storedUserData.device
  } else {
    user = Auth.createUser(name)
    const { userId } = user
    device = Auth.createDevice(userId, `${name}'s device`)
  }

  const context = { user, device }

  const authProvider = new AuthProvider({ user, device, storage })

  const repo = new Repo({
    network: [authProvider.wrap(new BrowserWebSocketClientAdapter('ws://localhost:3030'))],
    storage,
  })

  let team
  if (storedUserData && storedUserData.team) {
    team = new Auth.Team({
      source: objectToUint8Array(storedUserData.team.serializedGraph),
      context: { user, device },
      teamKeyring: storedUserData.team.teamKeyring,
    })
  } else if (withTeam) {
    // create a team
    team = Auth.createTeam(`team ${name}`, context)

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

  if (team) {
    await authProvider.addTeam(team)
  }

  repo.networkSubsystem.on('peer', payload => {
    console.log(`${name} is connected`, payload)
  })

  if (!storedUserData) {
    storeUserData({ name, user, device, team })
  }

  return {
    user,
    team,
    device,
    authProvider,
    repo,
    context,
  }
}

function loadUserData(name: string) {
  const raw = localStorage.getItem(`user:${name}`)

  if (raw) {
    const data = JSON.parse(raw)
    console.log('load', data)
    return data
  }
}

function storeUserData({ name, user, device, team }: any) {
  const data = {
    user,
    device,
    team: team && {
      serializedGraph: team.save(),
      teamKeyring: team.teamKeyring(),
    },
  }

  console.log('store', name, data)

  localStorage.setItem(`user:${name}`, JSON.stringify(data))
}

function objectToUint8Array(obj: Record<number, number>): Uint8Array {
  const arr = Object.values(obj)
  return new Uint8Array(arr)
}

function App() {
  return 'hello world'
}

export default App
