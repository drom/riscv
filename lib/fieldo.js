'use strict';

const fieldo = {
  rd:           {msb: 11, lsb:  7, count: 753},
  rs1:          {msb: 19, lsb: 15, count: 1007},
  rs2:          {msb: 24, lsb: 20, count: 501},
  rs3:          {msb: 31, lsb: 27, count: 26},
  rm:           {msb: 14, lsb: 12, count: 80},
  shamtq:       {msb: 26, lsb: 20, count: 6},
  shamtd:       {msb: 25, lsb: 20, count: 17},
  shamtw:       {msb: 24, lsb: 20, count: 29},
  shamtw4:      {msb: 23, lsb: 20, count: 2},

  imm12:        {msb: 31, lsb: 20, count: 23, bits: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]},

  imm12lo:      {msb: 11, lsb:  7, count: 9,  bits: [4, 3, 2, 1, 0]},
  imm12hi:      {msb: 31, lsb: 25, count: 12, bits: [11, 10, 9, 8, 7, 6, 5]},

  imm20:        {msb: 31, lsb: 12, count: 2,  bits: [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12]},
  jimm20:       {msb: 31, lsb: 12, count: 1,  bits: [20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 19, 18, 17, 16, 15, 14, 13, 12]},

  vd:           {msb: 11, lsb:  7, count: 412},
  vs1:          {msb: 19, lsb: 15, count: 128},
  vs2:          {msb: 24, lsb: 20, count: 380},
  vs3:          {msb: 11, lsb:  7, count: 38},
  vm:           {msb: 25, lsb: 25, count: 395},
  nf:           {msb: 31, lsb: 29, count: 72},
  wd:           {msb: 26, lsb: 26, count: 36},

  simm5:        {msb: 19, lsb: 15, count: 30, bits: [4, 3, 2, 1, 0]},

  rs1_p:        {msb:  9, lsb:  7, count: 19},
  rs2_p:        {msb:  4, lsb:  2, count: 15},
  rd_p:         {msb:  4, lsb:  2, count: 10},
  rd_rs1_n0:    {msb: 11, lsb:  7, count: 3},
  rd_rs1_p:     {msb:  9, lsb:  7, count: 18},
  rd_rs1:       {msb: 11, lsb:  7, count: 3},
  rd_n2:        {msb: 11, lsb:  7, count: 1},
  rd_n0:        {msb: 11, lsb:  7, count: 3},
  rs1_n0:       {msb: 11, lsb:  7, count: 1},
  c_rs2_n0:     {msb:  6, lsb:  2, count: 2},
  c_rs1_n0:     {msb: 11, lsb:  7, count: 1},
  c_rs2:        {msb:  6, lsb:  2, count: 6},
  c_sreg1:      {msb:  9, lsb:  7, count: 2},
  c_sreg2:      {msb:  4, lsb:  2, count: 2},

  aq:           {msb: 26, lsb: 26, count: 22},
  rl:           {msb: 25, lsb: 25, count: 22},

  // Compact Immediate Literals
  c_nzuimm10:   {msb: 12, lsb:  5, count: 1, bits: [5, 4, 9, 8, 7, 6, 2, 3]},

  c_uimm7lo:    {msb:  6, lsb:  5, count: 4, bits: [2, 6]},
  c_uimm7hi:    {msb: 12, lsb: 10, count: 4, bits: [5, 4, 3]},

  c_nzimm6lo:   {msb:  6, lsb:  2, count: 2, bits: [4, 3, 2, 1, 0]},
  c_nzimm6hi:   {msb: 12, lsb: 12, count: 2, bits: [5]},

  c_imm6lo:     {msb:  6, lsb:  2, count: 4, bits: [6, 3, 2, 1, 0]},
  c_imm6hi:     {msb: 12, lsb: 12, count: 4, bits: [5]},

  c_nzimm10lo:  {msb:  6, lsb:  2, count: 1, bits: [4, 6, 8, 7, 5]},
  c_nzimm10hi:  {msb: 12, lsb: 12, count: 1, bits: [9]},

  c_nzimm18lo:  {msb:  6, lsb:  2, count: 1, bits: [16, 15, 14, 13, 12]},
  c_nzimm18hi:  {msb: 12, lsb: 12, count: 1, bits: [17]},

  c_imm12:      {msb: 12, lsb:  2, count: 2, bits: [11, 4, 9, 8, 10, 6, 7, 3, 2, 1, 5]},

  c_bimm9lo:    {msb:  6, lsb:  2, count: 2, bits: [7, 6, 2, 1, 5]},
  c_bimm9hi:    {msb: 12, lsb: 10, count: 2, bits: [8, 4, 3]},

  c_uimm8splo:  {msb:  6, lsb:  2, count: 2, bits: [4, 3, 2, 7, 6]},
  c_uimm8sphi:  {msb: 12, lsb: 12, count: 2, bits: [5]},

  c_uimm8sp_s:  {msb: 12, lsb:  7, count: 2, bits: [5, 4, 3, 2, 7, 6]},

  c_nzuimm5:    {msb:  6, lsb:  2, count: 2, bits: [4, 3, 2, 1, 0]},

  c_nzuimm6lo:  {msb:  6, lsb:  2, count: 4, bits: [4, 3, 2, 1, 0]},
  c_nzuimm6hi:  {msb: 12, lsb: 12, count: 3, bits: [5]},

  c_uimm8lo:    {msb:  6, lsb:  5, count: 6, bits: [7, 6]},
  c_uimm8hi:    {msb: 12, lsb: 10, count: 6, bits: [5, 4, 3]},

  c_uimm9splo:  {msb:  6, lsb:  2, count: 3, bits: [4, 5, 8, 7, 6]},
  c_uimm9sphi:  {msb: 12, lsb: 12, count: 3, bits: [5]},

  c_uimm9sp_s:  {msb: 12, lsb:  7, count: 3, bits: [5, 4, 3, 8, 7, 6]},

  c_uimm2:      {msb:  6, lsb:  5, count: 2},
  c_uimm1:      {msb:  5, lsb:  5, count: 3},
  c_spimm:      {msb:  3, lsb:  2, count: 4},
  c_uimm9lo:    {msb:  6, lsb:  5, count: 2},
  c_uimm9hi:    {msb: 12, lsb: 10, count: 2},
  c_uimm10splo: {msb:  6, lsb:  2, count: 1},
  c_uimm10sphi: {msb: 12, lsb: 12, count: 1},
  c_uimm10sp_s: {msb: 12, lsb:  7, count: 1},
  c_index:      {msb:  9, lsb:  2, count: 1},
  c_rlist:      {msb:  7, lsb:  4, count: 4},

  bs:           {msb: 31, lsb: 30, count: 6}, // byte select for RV32K AES
  rnum:         {msb: 23, lsb: 20, count: 1},

  bimm12hi:     {msb: 31, lsb: 25, count: 6, bits: [12, 10, 9, 8, 7, 6, 5]},
  bimm12lo:     {msb: 11, lsb:  7, count: 6, bits: [4, 3, 2, 1, 11]},

  fm:           {msb: 31, lsb: 28, count: 1},
  pred:         {msb: 27, lsb: 24, count: 1},
  succ:         {msb: 23, lsb: 20, count: 1},

  csr:          {msb: 31, lsb: 20, count: 6},

  zimm:         {msb: 19, lsb: 15, count: 6},
  zimm10:       {msb: 29, lsb: 20, count: 1},
  zimm11:       {msb: 30, lsb: 20, count: 1},

  // rv32_zpn
  imm2:         {msb: 21, lsb: 20, count: 1},
  // rv_zpn
  imm3:         {msb: 22, lsb: 20, count: 9},
  imm4:         {msb: 23, lsb: 20, count: 8},
  imm5:         {msb: 24, lsb: 20, count: 11},
  imm6:         {msb: 25, lsb: 20, count: 1}
};

module.exports = fieldo;

/* eslint camelcase: 0 */
