import { describe, it, expect } from 'vitest'
import { extractRdapInfo } from '../rdap'

describe('extractRdapInfo', () => {
  it('витягує назву і дату з RDAP відповіді', () => {
    const raw = {
      name: 'UA-NREN-1',
      handle: '193.108.0.0 - 193.108.31.255',
      startAddress: '193.108.0.0',
      endAddress: '193.108.31.255',
      ipVersion: 'v4',
      entities: [
        {
          vcardArray: ['vcard', [
            ['fn', {}, 'text', 'URAN Association'],
          ]],
          roles: ['registrant'],
          entities: [
            {
              vcardArray: ['vcard', [
                ['email', {}, 'text', 'abuse@uran.ua'],
              ]],
              roles: ['abuse'],
            },
          ],
        },
      ],
      events: [
        { eventAction: 'registration', eventDate: '2012-01-01T00:00:00Z' },
        { eventAction: 'last changed', eventDate: '2020-05-15T00:00:00Z' },
      ],
    }

    const info = extractRdapInfo(raw)
    expect(info.name).toBe('UA-NREN-1')
    expect(info.orgName).toBe('URAN Association')
    expect(info.abuseEmail).toBe('abuse@uran.ua')
    expect(info.registrationDate).toBe('2012-01-01T00:00:00Z')
  })
})
