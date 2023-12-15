import { AuthProvider } from '../../packages/auth-provider-automerge-repo/dist/index'
import * as Auth from '../../packages/auth/dist/index'
import { Repo } from '@automerge/automerge-repo'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { DummyStorageAdapter } from './DummyStorageAdapter'

const storage = new DummyStorageAdapter()

const userName = 'bob'
const user = Auth.createUser(userName)
const { userId } = user
const device = Auth.createDevice(userId, `${userName}'s device`)
const context = { user, device }

const authProvider = new AuthProvider({ user, device, storage })

const repo = new Repo({
  network: [authProvider.wrap(new BrowserWebSocketClientAdapter('ws://localhost:3030'))],
  storage,
})

repo.networkSubsystem.on('peer', payload => {
  console.log('new peer', payload)
})

// create a team
const team = Auth.createTeam('team A', context)
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

function App() {
  return 'hello world'
}

export default App
