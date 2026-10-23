---
name: dba-real-application-clusters
description: How to plan, install, configure and operate Oracle Real Application Clusters: interconnect and storage prerequisites, cluster-wide parameters, SRVCTL start/stop, services and transparent application failover, and adding or removing nodes and instances, based on Chapter 50 (Oracle Real Application Clusters) of Oracle Database 11g: The Complete Reference. Use when the user mentions RAC, CRS/clusterware, srvctl, instances or threads, interconnect or MTU, TAF or failover in tnsnames.ora, V$ACTIVE_INSTANCES, cluster parameter mismatches, or contention between nodes on the same blocks.
---

# Oracle Real Application Clusters

RAC runs several instances against one database on shared disks, giving failover and more CPU and memory. It only scales if nodes share data rather than fight over the same blocks, so design the network, services and workload placement as carefully as the database itself.

## Architecture essentials

- All instances share the datafiles and control files. Each instance has its own online redo log **thread** (the `THREAD` parameter) and undo tablespace, all on shared storage.
- Every instance must be able to read all redo threads, so a surviving instance can archive and recover for a failed one.
- If an instance fails, clients can reconnect through another instance.

## Prerequisites

- Each node: shared external disks, redundant switches, one private IP (interconnect) and one public IP (clients and failover), TCP/IP and an Oracle-certified interconnect.
- Apply all required OS patches before installing.
- Get involved in network design. Block transfers over the interconnect dominate RAC performance. With an MTU of 1500 bytes, a 32K block needs more than 20 packets; if the hardware allows, raise the MTU (jumbo frames) with the system administrators.

## Installation

1. Install Oracle Clusterware (CRS) with OUI. It manages cluster membership, resources, high availability and services.
2. Install ASM (11g recommends the CRS home) and create disk groups. Use normal redundancy with failure groups if there is no hardware mirroring, external redundancy if there is.
3. Install the database software with RAC in a **separate** Oracle home; DBCA creates the RAC database and services. DBUA upgrades an older clustered database.

## Initialization parameters

Use one shared server parameter file for all instances.

| Rule | Parameters |
|---|---|
| Must be identical | `ACTIVE_INSTANCE_COUNT`, `ARCHIVE_LAG_TARGET`, `COMPATIBLE`, `CLUSTER_DATABASE`, `CLUSTER_DATABASE_INSTANCES`, `CONTROL_FILES`, `DB_BLOCK_SIZE`, `DB_DOMAIN`, `DB_FILES`, `DB_NAME`, `DB_RECOVERY_FILE_DEST(_SIZE)`, `DB_UNIQUE_NAME`, `INSTANCE_TYPE`, `PARALLEL_MAX_SERVERS`, `REMOTE_LOGIN_PASSWORDFILE`, `UNDO_MANAGEMENT` (and `DML_LOCKS`, `RESULT_CACHE_MAX_SIZE` when 0) |
| Must be unique | `INSTANCE_NAME`, `INSTANCE_NUMBER`, `UNDO_TABLESPACE`, `ASM_PREFERRED_READ_FAILURE_GROUPS` (ASM) |
| Should be identical | `LICENSE_MAX_USERS`, `LOG_ARCHIVE_FORMAT` (recovery and Data Guard), `SPFILE`, `TRACE_ENABLED`, `UNDO_RETENTION` |

- Set `INSTANCE_NUMBER` and `THREAD` to the same value within an instance.
- An `ALTER SYSTEM SET` is saved only in the spfile of the instance where it runs; a split spfile makes instances behave differently. Use `sid='*'` or `sid='inst1'` deliberately.

```sql
alter system set undo_retention = 1800 scope = both sid = '*';
alter system set undo_tablespace = 'UNDOTBS2' scope = spfile sid = 'orders2';
```

- Avoid dynamic memory management in RAC; use fixed cache sizes to avoid extra inter-instance traffic.

## Starting and stopping

- Stopping one instance does not affect the others. Stopping a shared database means stopping every instance.
- `shutdown normal` / `immediate` need no recovery. After `shutdown abort`, a surviving instance recovers the dead one; if it was the last, the next to start recovers.
- `shutdown transactional local` waits only for this instance's transactions; without `local` it waits for transactions on all instances.

```sh
srvctl status database -d orders
srvctl start database -d orders -o open
srvctl start instance -d orders -i orders1,orders2
srvctl stop instance  -d orders -i orders2 -o immediate
srvctl start asm -n node1
```

- Other verbs: `add`, `remove`, `config`, `modify`, `enable`, `disable`, `relocate service`, `getenv`/`setenv`/`unsetenv`, on `database | instance | service | nodeapps | asm`.
- Check membership with `select inst_id, instance_name, host_name from gv$instance;` or `V$ACTIVE_INSTANCES`.
- Stopping instances, removing configuration or relocating services affects users. Confirm the cluster and target, and get approval.

## Services and transparent application failover

- Define services (`srvctl add service` or DBCA) with **preferred** and **available** instances; AWR collects statistics per service.
- TAF re-establishes a session through another instance when its instance fails; storage must itself be fault tolerant.

```text
orders_svc =
  (description = (load_balance = on) (failover = on)
    (address_list =
      (address = (protocol = tcp)(host = node1-vip)(port = 1521))
      (address = (protocol = tcp)(host = node2-vip)(port = 1521)))
    (connect_data = (service_name = orders_svc)))
```

- Session state set with `alter session` or package variables is lost on failover; the application must restore it.
- Place workloads deliberately. Avoid long-running updates of the same blocks from different nodes; route users of the same data to the same node instead of relying on round-robin.

## Adding and removing nodes and instances

1. Prepare the node like the others (clone the OS image), with networking and user equivalence for remote commands.
2. The cluster administrator adds it to the clusterware; run `addNode.sh` from the CRS home's OUI, then the root scripts, `CRSSETUP` and `RACGONS` as documented for your platform.
3. Add an instance with DBCA: Real Application Clusters database, Add Instance.
4. To remove an instance, run DBCA from a **different** node, relocate its services, then delete it.

## Workflow

1. Validate network (private/public IPs, MTU, certified interconnect), shared storage and OS patches.
2. Install clusterware, then ASM, then RAC database software in its own home; create the database with DBCA.
3. Review the spfile against the identical/unique parameter rules.
4. Design services and assign preferred/available instances by workload, minimizing cross-node block contention.
5. Configure TAF and test failover by stopping one node while a session runs queries.
6. Operate with `srvctl` and verify state with `srvctl status` and `gv$instance`.

## Red flags

- Default 1500-byte MTU with large blocks on a busy interconnect.
- Separate spfiles per instance, or `ALTER SYSTEM` without a deliberate `sid`.
- Mismatched `LOG_ARCHIVE_FORMAT` or `UNDO_RETENTION` across instances.
- Automatic memory resizing on RAC instances.
- Round-robin placement of users who update the same hot rows.
- Assuming TAF preserves session state or in-flight transactions.
- Removing an instance with DBCA from the node that hosts it.

## Related

- `../DatabaseAdministration/databaseAdministration.md` — startup/shutdown modes, ASM and undo.
- `../TuningApplicationsAndSql/tuningApplicationsAndSql.md` — AWR statistics per service.
- `../../CriticalConcepts/InstallingAndCreating/installingAndCreating.md` — OUI and DBCA.
- `../../CriticalConcepts/ArchitectureOptions/architectureOptions.md` — where RAC fits among availability options.
- `../ResultCache/resultCache.md` — per-instance result caches.
- `../../../../CleanCode/Concurrency/concurrency.md` — limiting shared mutable state.

Version note: in 11g Release 2 clusterware became Grid Infrastructure (with SCAN listeners), and 12c srvctl prefers long options such as `-db` and `-instance`.
