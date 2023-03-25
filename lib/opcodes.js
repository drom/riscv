'use strict';

exports.ROOT = 'https://raw.githubusercontent.com/riscv/riscv-opcodes/master/';

exports.RATIFIED_OPCODES = `

rv_i
rv32_i
rv64_i

rv_m
rv64_m

rv_c
rv_c_d

rv32_c
rv64_c

rv32_c_f

rv_a
rv64_a

rv_f
rv64_f

rv_d
rv_d_zfh
rv64_d

rv_q
rv64_q
rv_q_zfh

rv_h
rv64_h

rv_s
rv_svinval
rv_system

rv_v
rv_v_aliases

rv_zba
rv64_zba

rv_zbb
rv32_zbb
rv64_zbb

rv_zbc

rv_zbs
rv32_zbs
rv64_zbs

rv_zbkb
rv32_zbkb
rv64_zbkb

rv_zbkc

rv_zbkx


rv_zk
rv32_zk
rv64_zk

rv_zkn
rv32_zkn
rv64_zkn

rv_zknh
rv32_zknh
rv64_zknh

rv_zks
rv32_zks
rv64_zks

rv_zksed

rv_zksh

rv32_zknd
rv64_zknd

rv32_zkne
rv64_zkne

rv_zcb
rv64_zcb

rv_zfh
rv64_zfh

rv_zcmp
rv_zcmt


rv_zicbo
rv_zicsr
rv_zifencei

rv_zawrs

`.trim().split(/\s+/);

exports.UNRATIFIED_OPCODES = `

rv128_i

rv_c_zihintntl
rv128_c

rv_b
rv64_b

rv_zbe
rv64_zbe

rv_zbf
rv64_zbf

rv64_zbm

rv_zbp
rv32_zbp
rv64_zbp

rv_zbpbo
rv32_zbpbo
rv64_zbpbo

rv_zbr
rv64_zbr

rv_zbt
rv32_zbt
rv64_zbt

rv_zihintntl

rv_zpn
rv32_zpn
rv64_zpn

rv_zpsf
rv32_zpsf

rv_d_zfa
rv32_d_zfa

rv_q_zfa
rv64_q_zfa

rv_f_zfa

rv_zfh_zfa

rv_smrnmi

rv_zicond


`.trim().split(/\s+/);

exports.ALL_OPCODES = exports.RATIFIED_OPCODES.concat(exports.UNRATIFIED_OPCODES);
