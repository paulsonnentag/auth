import { type CommandFn } from '../types.js'

export const teamMember: CommandFn = (subject, userName: string) => {
  return cy
    .wrap(subject)
    .find('.MemberTable')
    .findByText(userName)
    .parents('tr')
}
