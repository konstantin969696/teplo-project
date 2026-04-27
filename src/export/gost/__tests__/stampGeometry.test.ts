/**
 * Unit tests for GOST stamp geometry constants.
 * Validates column/height sums match the GOST R 21.101-2020 spec.
 */

import { describe, it, expect } from 'vitest'
import {
  STAMP_FORM5_WIDTH_MM,
  STAMP_FORM5_HEIGHT_MM,
  STAMP_FORM6_WIDTH_MM,
  STAMP_FORM6_HEIGHT_MM,
  STAMP_FORM5_GEOMETRY,
  STAMP_FORM6_GEOMETRY,
} from '../stampGeometry'

describe('GOST stamp geometry — Form 5 (185×40 мм)', () => {
  it('overall dimensions match spec', () => {
    expect(STAMP_FORM5_WIDTH_MM).toBe(185)
    expect(STAMP_FORM5_HEIGHT_MM).toBe(40)
    expect(STAMP_FORM5_GEOMETRY.width).toBe(185)
    expect(STAMP_FORM5_GEOMETRY.height).toBe(40)
  })

  it('title + company = total width', () => {
    const { title, company } = STAMP_FORM5_GEOMETRY
    expect(title.width + company.width).toBe(STAMP_FORM5_WIDTH_MM)
  })

  it('company block spans full height', () => {
    expect(STAMP_FORM5_GEOMETRY.company.height).toBe(STAMP_FORM5_HEIGHT_MM)
  })

  it('vertical layout: title + designation + stageRow + signers = 40mm', () => {
    const { title, designation, stageRow, signers } = STAMP_FORM5_GEOMETRY
    const total = title.height + designation.height + stageRow.height + signers.height
    expect(total).toBe(STAMP_FORM5_HEIGHT_MM)
  })

  it('signers columns sum to signers.width', () => {
    const { signers } = STAMP_FORM5_GEOMETRY
    const sum = signers.cols.reduce((acc, c) => acc + c.width, 0)
    expect(sum).toBe(signers.width)
  })

  it('stageRow y === title.height + designation.height', () => {
    const { title, designation, stageRow } = STAMP_FORM5_GEOMETRY
    expect(stageRow.y).toBe(title.height + designation.height)
  })

  it('signers y === stageRow.y + stageRow.height', () => {
    const { stageRow, signers } = STAMP_FORM5_GEOMETRY
    expect(signers.y).toBe(stageRow.y + stageRow.height)
  })

  it('signers has 5 rows (Разраб./Проверил/ГИП/Н.контр./Утв.)', () => {
    expect(STAMP_FORM5_GEOMETRY.signers.rows.length).toBe(5)
  })
})

describe('GOST stamp geometry — Form 6 (185×15 мм)', () => {
  it('overall dimensions match spec', () => {
    expect(STAMP_FORM6_WIDTH_MM).toBe(185)
    expect(STAMP_FORM6_HEIGHT_MM).toBe(15)
    expect(STAMP_FORM6_GEOMETRY.width).toBe(185)
    expect(STAMP_FORM6_GEOMETRY.height).toBe(15)
  })

  it('horizontal layout: signers.width + designation.width + company.width = 185mm', () => {
    const { signers, designation, company } = STAMP_FORM6_GEOMETRY
    expect(signers.width + designation.width + company.width).toBe(STAMP_FORM6_WIDTH_MM)
  })

  it('signers columns sum to signers.width', () => {
    const { signers } = STAMP_FORM6_GEOMETRY
    const sum = signers.cols.reduce((acc, c) => acc + c.width, 0)
    expect(sum).toBe(signers.width)
  })

  it('designation.x === signers.width', () => {
    const { signers, designation } = STAMP_FORM6_GEOMETRY
    expect(designation.x).toBe(signers.width)
  })

  it('company.x === signers.width + designation.width', () => {
    const { signers, designation, company } = STAMP_FORM6_GEOMETRY
    expect(company.x).toBe(signers.width + designation.width)
  })

  it('designation + sheetRow cover full height', () => {
    const { designation, sheetRow } = STAMP_FORM6_GEOMETRY
    expect(designation.height + sheetRow.height).toBe(STAMP_FORM6_HEIGHT_MM)
  })

  it('sheetRow.y === designation.height', () => {
    const { designation, sheetRow } = STAMP_FORM6_GEOMETRY
    expect(sheetRow.y).toBe(designation.height)
  })
})
